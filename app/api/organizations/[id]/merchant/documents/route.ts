import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  isAllianceEnabled,
  uploadMerchantDocument,
  PayNLAllianceNotActivatedError,
  PayNLError,
  type KycDocumentType,
} from '@/lib/paynl-alliance';

/**
 * POST /api/organizations/[id]/merchant/documents
 *
 * Upload a single KYC document for a sub-merchant. Called after the org
 * has been onboarded via POST /merchant/onboard — the org must already
 * have a paynl_merchant_id.
 *
 * Request: multipart/form-data with:
 *   file       — the document (PDF / PNG / JPEG / WEBP, ≤10 MB)
 *   docType    — one of: kvk_extract, ubo_extract, id_front, id_back,
 *                bank_statement, power_of_attorney, other
 *   personId   — OUR organization_persons.id (not Pay.nl's). Required for
 *                id_front / id_back.
 *
 * Flow:
 *   1. Store the file in the private `kyc-documents` Supabase Storage bucket
 *   2. Forward it to Pay.nl via the Alliance API
 *   3. Record metadata in `organization_kyc_documents`
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOC_TYPES: readonly KycDocumentType[] = [
  'kvk_extract',
  'ubo_extract',
  'id_front',
  'id_back',
  'bank_statement',
  'power_of_attorney',
  'other',
];

const PERSON_SCOPED_DOCS: readonly KycDocumentType[] = ['id_front', 'id_back'];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

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

  if (!isAllianceEnabled()) {
    return NextResponse.json(
      { error: 'Pay.nl Alliance is not yet activated on this platform.' },
      { status: 503 },
    );
  }

  // Parse multipart body
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const docTypeRaw = formData.get('docType');
  const personIdRaw = formData.get('personId');
  const file = formData.get('file');

  if (typeof docTypeRaw !== 'string' || !DOC_TYPES.includes(docTypeRaw as KycDocumentType)) {
    return NextResponse.json(
      { error: `docType must be one of: ${DOC_TYPES.join(', ')}` },
      { status: 400 },
    );
  }
  const docType = docTypeRaw as KycDocumentType;

  const personScoped = PERSON_SCOPED_DOCS.includes(docType);
  let personId: string | null = null;
  if (personScoped) {
    if (typeof personIdRaw !== 'string' || !UUID_RE.test(personIdRaw)) {
      return NextResponse.json(
        { error: `personId is required and must be a UUID for docType "${docType}"` },
        { status: 400 },
      );
    }
    personId = personIdRaw;
  } else if (typeof personIdRaw === 'string' && personIdRaw) {
    // Allow personId on non-person-scoped docs, but validate format.
    if (!UUID_RE.test(personIdRaw)) {
      return NextResponse.json({ error: 'personId must be a UUID' }, { status: 400 });
    }
    personId = personIdRaw;
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'file is empty' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `file exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported mime type "${file.type}". Allowed: PNG, JPEG, WEBP, PDF.` },
      { status: 415 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify org exists + has a merchant id
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, paynl_merchant_id')
    .eq('id', id)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (!org.paynl_merchant_id) {
    return NextResponse.json(
      { error: 'Organization has not been onboarded yet. Submit /merchant/onboard first.' },
      { status: 409 },
    );
  }

  // If personId supplied, verify it belongs to this org and fetch the Pay.nl id
  let paynlPersonId: string | null = null;
  if (personId) {
    const { data: person, error: personError } = await supabaseAdmin
      .from('organization_persons')
      .select('id, organization_id, paynl_person_id')
      .eq('id', personId)
      .single();
    if (personError || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    if (person.organization_id !== id) {
      return NextResponse.json({ error: 'Person does not belong to this org' }, { status: 403 });
    }
    paynlPersonId = person.paynl_person_id ?? null;
    if (personScoped && !paynlPersonId) {
      return NextResponse.json(
        {
          error:
            'This person has no Pay.nl id yet. Pay.nl must acknowledge the merchant submission before ID documents can be attached.',
        },
        { status: 409 },
      );
    }
  }

  // ---- 1. Persist to Supabase Storage -------------------------------------
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'upload';
  const storagePath = `${id}/${docType}/${crypto.randomUUID()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    console.error('[Alliance] Storage upload failed', {
      organizationId: id,
      docType,
      error: uploadError.message,
    });
    return NextResponse.json({ error: 'Failed to store the document' }, { status: 500 });
  }

  // ---- 2. Forward to Pay.nl -----------------------------------------------
  let paynlDocumentId: string | null = null;
  let remoteStatus: 'uploaded' | 'forwarded' | 'accepted' | 'rejected' = 'uploaded';
  try {
    const remote = await uploadMerchantDocument({
      merchantId: org.paynl_merchant_id,
      docType,
      paynlPersonId: paynlPersonId ?? undefined,
      fileName: safeName,
      mimeType: file.type,
      data: new Uint8Array(arrayBuffer),
    });
    paynlDocumentId = remote.documentId;
    remoteStatus =
      remote.status === 'accepted'
        ? 'accepted'
        : remote.status === 'rejected'
          ? 'rejected'
          : 'forwarded';
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      // File is stored locally — keep it so the user can retry without re-uploading.
      console.error('[Alliance] Pay.nl document upload failed', {
        organizationId: id,
        storagePath,
        docType,
        status: error.status,
      });
      return NextResponse.json(
        {
          error: 'Stored locally but Pay.nl rejected the upload. Please try again or contact support.',
          storagePath,
        },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error forwarding document', {
      organizationId: id,
      storagePath,
      error,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // ---- 3. Persist metadata row --------------------------------------------
  const { data: docRow, error: insertError } = await supabaseAdmin
    .from('organization_kyc_documents')
    .insert({
      organization_id: id,
      person_id: personId,
      doc_type: docType,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      paynl_document_id: paynlDocumentId,
      status: remoteStatus,
      uploaded_by: auth.user?.id ?? null,
    })
    .select('id, doc_type, status, uploaded_at')
    .single();

  if (insertError) {
    console.error('[Alliance] Failed to persist document metadata', {
      organizationId: id,
      storagePath,
      error: insertError.message,
    });
    return NextResponse.json(
      {
        error: 'Uploaded to Pay.nl but failed to record metadata. Contact support.',
        paynlDocumentId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: docRow.id,
    docType: docRow.doc_type,
    status: docRow.status,
    uploadedAt: docRow.uploaded_at,
    paynlDocumentId,
  });
}
