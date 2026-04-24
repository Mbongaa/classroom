import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  addDocument,
  isAllianceEnabled,
  PayNLError,
  PayNLAllianceNotActivatedError,
} from '@/lib/paynl-alliance';
import { generateAgreementPdf } from '@/lib/agreement-pdf';

/**
 * POST /api/organizations/[id]/merchant/sign-agreement
 *
 * Generates the pre-filled Pay.nl Samenwerkingsovereenkomst PDF with the
 * admin's drawn signature embedded, persists it to the kyc-documents storage
 * bucket (audit trail), forwards to Pay.nl as the "agreement" KYC document,
 * and records the signature metadata on the organization_kyc_documents row.
 *
 * Body: {
 *   documentCode:     string,   // Pay.nl-issued doc code
 *   signeeName:       string,   // "Naam"
 *   signedPlace:      string,   // "Plaats"
 *   signatureDataUrl: string,   // "data:image/png;base64,..."
 *   signeeTitle?:     string,   // optional — default "Signee", stored in audit record only
 * }
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const MAX_SIGNATURE_BYTES = 500_000; // 500 KB — a canvas PNG is usually <50 KB
const STORAGE_BUCKET = 'kyc-documents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (typeof b.documentCode !== 'string' || !b.documentCode) {
    return NextResponse.json({ error: 'documentCode is required' }, { status: 400 });
  }
  if (typeof b.signeeName !== 'string' || !b.signeeName.trim()) {
    return NextResponse.json({ error: 'signeeName is required' }, { status: 400 });
  }
  if (typeof b.signedPlace !== 'string' || !b.signedPlace.trim()) {
    return NextResponse.json({ error: 'signedPlace is required' }, { status: 400 });
  }
  if (typeof b.signatureDataUrl !== 'string' || !b.signatureDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return NextResponse.json(
      { error: 'signatureDataUrl must be a PNG data URL' },
      { status: 400 },
    );
  }

  // Decode the canvas PNG.
  const base64 = b.signatureDataUrl.slice(PNG_DATA_URL_PREFIX.length);
  let signaturePng: Buffer;
  try {
    signaturePng = Buffer.from(base64, 'base64');
  } catch {
    return NextResponse.json({ error: 'signatureDataUrl is not valid base64' }, { status: 400 });
  }
  if (signaturePng.length === 0 || signaturePng.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json(
      { error: 'signatureDataUrl is empty or too large' },
      { status: 400 },
    );
  }

  const signeeName = b.signeeName.trim();
  const signedPlace = b.signedPlace.trim();
  const signeeTitle =
    typeof b.signeeTitle === 'string' && b.signeeTitle.trim() ? b.signeeTitle.trim() : 'Signee';

  const supabaseAdmin = createAdminClient();

  // Fetch org data to pre-fill the agreement.
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, kvk_number, address_street, address_house_number, city')
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Verify the document code belongs to this org and isn't already accepted.
  const { data: doc, error: docError } = await supabaseAdmin
    .from('organization_kyc_documents')
    .select('id, paynl_document_code, doc_type, status')
    .eq('organization_id', id)
    .eq('paynl_document_code', b.documentCode)
    .single();

  if (docError || !doc) {
    return NextResponse.json(
      { error: 'Document not found for this organization' },
      { status: 404 },
    );
  }
  if (doc.status === 'accepted') {
    return NextResponse.json({ error: 'Agreement is already accepted.' }, { status: 409 });
  }

  const signedAt = new Date().toISOString();
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined;

  // Generate the signed PDF.
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateAgreementPdf(
      {
        name: org.name,
        kvk_number: org.kvk_number,
        address_street: org.address_street,
        address_house_number: org.address_house_number,
        city: org.city,
      },
      {
        signeeName,
        signeeTitle,
        signedPlace,
        signedAt,
        signaturePng,
        ipAddress,
      },
    );
  } catch (err) {
    console.error('[Agreement] PDF generation failed', { organizationId: id, error: err });
    return NextResponse.json({ error: 'Failed to generate agreement PDF' }, { status: 500 });
  }

  // Persist the signed PDF to Supabase Storage for audit / re-download.
  const storagePath = `${id}/agreement/${Date.now()}-signed.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[Agreement] Storage upload failed', {
      organizationId: id,
      storagePath,
      error: uploadError.message,
    });
    return NextResponse.json(
      { error: 'Failed to persist signed agreement' },
      { status: 500 },
    );
  }

  // Record locally first so the signature is preserved even if the Pay.nl
  // upload below fails (we can retry from the stored PDF).
  await supabaseAdmin
    .from('organization_kyc_documents')
    .update({
      status: 'uploaded',
      storage_path: storagePath,
      mime_type: 'application/pdf',
      file_size_bytes: pdfBytes.length,
      signed_by: signeeName,
      signed_at: signedAt,
      signed_place: signedPlace,
      uploaded_at: signedAt,
      last_synced_at: signedAt,
    })
    .eq('id', doc.id);

  if (!isAllianceEnabled()) {
    // Alliance disabled (local/staging): record locally and return success.
    console.log('[Agreement] Alliance disabled — agreement recorded locally only', {
      organizationId: id,
      signeeName,
      storagePath,
    });
    return NextResponse.json({
      ok: true,
      status: 'uploaded',
      uploadedAt: signedAt,
      storagePath,
      source: 'local',
    });
  }

  // Forward to Pay.nl.
  try {
    const fileName = `overeenkomst_${org.name.replace(/[^a-zA-Z0-9]/g, '_')}_${signedAt.split('T')[0]}.pdf`;

    const uploadResult = await addDocument({
      code: b.documentCode,
      fileName,
      data: pdfBytes,
    });

    const finalStatus = uploadResult.status === 'ACCEPTED' ? 'accepted' : 'forwarded';
    await supabaseAdmin
      .from('organization_kyc_documents')
      .update({
        status: finalStatus,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', doc.id);

    console.log('[Agreement] Signed agreement uploaded to Pay.nl', {
      organizationId: id,
      documentCode: b.documentCode,
      signeeName,
      paynlStatus: uploadResult.status,
      storagePath,
    });

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      uploadedAt: signedAt,
      storagePath,
      source: 'paynl',
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ ok: true, status: 'uploaded', storagePath, source: 'local' });
    }
    if (error instanceof PayNLError) {
      console.error('[Agreement] Pay.nl upload failed', {
        organizationId: id,
        documentCode: b.documentCode,
        status: error.status,
        body: error.body,
      });
      return NextResponse.json(
        {
          error: `Agreement was signed and saved locally but Pay.nl upload failed (HTTP ${error.status}). It will be retried on the next status refresh.`,
          status: 'uploaded',
          uploadedAt: signedAt,
          storagePath,
        },
        { status: 502 },
      );
    }
    console.error('[Agreement] Unexpected error during upload', { organizationId: id, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
