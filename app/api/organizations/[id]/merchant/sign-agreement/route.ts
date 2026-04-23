import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { addDocument, isAllianceEnabled, PayNLError, PayNLAllianceNotActivatedError } from '@/lib/paynl-alliance';
import { generateAgreementPdf } from '@/lib/agreement-pdf';

/**
 * POST /api/organizations/[id]/merchant/sign-agreement
 *
 * Generates the pre-filled Sub-Merchant Services Agreement PDF, records
 * the digital signature, and uploads the PDF directly to Pay.nl — no
 * file upload needed from the admin.
 *
 * Body: { documentCode: string; signeeName: string; signeeTitle: string }
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (typeof b.signeeTitle !== 'string' || !b.signeeTitle.trim()) {
    return NextResponse.json({ error: 'signeeTitle is required' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Fetch org data to pre-fill the agreement.
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, kvk_number, address_street, address_house_number, address_postal_code, city, country, contact_email',
    )
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Verify the document code belongs to this org.
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
        address_postal_code: org.address_postal_code,
        city: org.city,
        country: org.country,
        contact_email: org.contact_email,
      },
      {
        signeeName: b.signeeName.trim(),
        signeeTitle: b.signeeTitle.trim(),
        signedAt,
        ipAddress,
      },
    );
  } catch (err) {
    console.error('[Agreement] PDF generation failed', { organizationId: id, error: err });
    return NextResponse.json({ error: 'Failed to generate agreement PDF' }, { status: 500 });
  }

  // Record the signed agreement locally first so we have a record even if
  // the Pay.nl upload fails (we can retry later).
  await supabaseAdmin
    .from('organization_kyc_documents')
    .update({
      status: 'uploaded',
      uploaded_at: signedAt,
      last_synced_at: signedAt,
    })
    .eq('id', doc.id);

  if (!isAllianceEnabled()) {
    // Alliance disabled (local/staging): record locally and return success.
    console.log('[Agreement] Alliance disabled — agreement recorded locally only', {
      organizationId: id,
      signeeName: b.signeeName,
    });
    return NextResponse.json({
      ok: true,
      status: 'uploaded',
      uploadedAt: signedAt,
      source: 'local',
    });
  }

  // Upload to Pay.nl.
  try {
    const fileName = `agreement_${org.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(signedAt).toISOString().split('T')[0]}.pdf`;

    const uploadResult = await addDocument({
      code: b.documentCode,
      fileName,
      data: pdfBytes,
    });

    // Update to forwarded (uploaded to Pay.nl).
    const finalStatus = uploadResult.status === 'ACCEPTED' ? 'accepted' : 'forwarded';
    await supabaseAdmin
      .from('organization_kyc_documents')
      .update({
        status: finalStatus,
        uploaded_at: signedAt,
        last_synced_at: signedAt,
      })
      .eq('id', doc.id);

    console.log('[Agreement] Signed agreement uploaded to Pay.nl', {
      organizationId: id,
      documentCode: b.documentCode,
      signeeName: b.signeeName,
      paynlStatus: uploadResult.status,
    });

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      uploadedAt: signedAt,
      source: 'paynl',
    });
  } catch (error) {
    // Pay.nl upload failed, but we already saved locally — that's better than
    // losing the signature. Surface the error so the admin knows.
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ ok: true, status: 'uploaded', source: 'local' });
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
        },
        { status: 502 },
      );
    }
    console.error('[Agreement] Unexpected error during upload', { organizationId: id, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
