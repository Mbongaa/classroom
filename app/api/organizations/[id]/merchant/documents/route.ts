import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  addDocument,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';
import { assertPayNLProductionConfig } from '@/lib/paynl-production';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/organizations/[id]/merchant/documents
 *
 * Upload one of the KYC documents Pay.nl has requested for this merchant.
 *
 * Prerequisites:
 *   - Organization already has a paynl_merchant_id (via /merchant/onboard)
 *   - A row in organization_kyc_documents with the given `documentCode`
 *     exists and is in status='requested'. That row is created by
 *     /merchant/onboard after it reads /v2/merchants/{code}/info, or later
 *     by a refresh.
 *
 * Request: multipart/form-data with
 *   file         — the document (PDF / PNG / JPEG / WEBP, ≤10 MB)
 *   documentCode — the Pay.nl-issued upload identifier from merchants/info
 *                  (stored on organization_kyc_documents.paynl_document_code)
 *
 * Flow:
 *   1. Resolve the existing requested row by (organization_id, documentCode)
 *   2. Store bytes in the private `kyc-documents` Supabase Storage bucket
 *   3. POST /v2/documents with base64-encoded file
 *   4. Update the existing row with storage path, file meta, and status
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

const STORAGE_BUCKET = 'kyc-documents';

type LocalDocStatus = 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected';

function mapRemoteDocStatus(remote: string): LocalDocStatus {
  switch (remote?.toUpperCase()) {
    case 'UPLOADED':
      return 'forwarded';
    case 'ACCEPTED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    case 'REQUESTED':
      return 'requested';
    default:
      return 'forwarded';
  }
}

function sanitiseFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'upload';
}

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

  const limiter = await rateLimit(
    `merchant:documents:${id}:${auth.user?.id ?? getClientIp(request.headers)}`,
    {
      limit: 12,
      windowMs: 60_000,
    },
  );
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: 'Too many document uploads. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limiter.retryAfterSeconds ?? 60) },
      },
    );
  }

  if (!isAllianceEnabled()) {
    return NextResponse.json(
      { error: 'Pay.nl Alliance is not yet activated on this platform.' },
      { status: 503 },
    );
  }
  const productionConfigError = assertPayNLProductionConfig();
  if (productionConfigError) {
    return NextResponse.json({ error: productionConfigError }, { status: 503 });
  }

  // ---- Parse multipart ------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const documentCodeRaw = formData.get('documentCode');
  const file = formData.get('file');

  if (typeof documentCodeRaw !== 'string' || documentCodeRaw.trim().length === 0) {
    return NextResponse.json(
      { error: 'documentCode is required (the Pay.nl code from merchants/info)' },
      { status: 400 },
    );
  }
  const documentCode = documentCodeRaw.trim();

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

  // ---- Resolve org + requested row -----------------------------------------
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

  const { data: existingDoc, error: docLookupError } = await supabaseAdmin
    .from('organization_kyc_documents')
    .select('id, status, paynl_document_code, doc_type, person_id')
    .eq('organization_id', id)
    .eq('paynl_document_code', documentCode)
    .maybeSingle();

  if (docLookupError) {
    console.error('[Alliance] Failed to look up requested doc row', {
      organizationId: id,
      documentCode,
      error: docLookupError.message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  if (!existingDoc) {
    return NextResponse.json(
      {
        error:
          `No Pay.nl-requested document exists for code "${documentCode}". ` +
          'Refresh the merchant info from Pay.nl and try again.',
      },
      { status: 404 },
    );
  }
  if (existingDoc.status === 'accepted') {
    return NextResponse.json(
      { error: 'This document has already been accepted by Pay.nl.' },
      { status: 409 },
    );
  }

  // ---- 1. Persist to Supabase Storage --------------------------------------
  const safeName = sanitiseFileName(file.name);
  const storagePath = `${id}/${documentCode}/${crypto.randomUUID()}-${safeName}`;
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
      documentCode,
      error: uploadError.message,
    });
    return NextResponse.json({ error: 'Failed to store the document' }, { status: 500 });
  }

  // ---- 2. Forward to Pay.nl -------------------------------------------------
  let paynlDocumentId: string | null = null;
  let remoteStatus: LocalDocStatus = 'forwarded';
  try {
    const remote = await addDocument({
      code: documentCode,
      fileName: safeName,
      data: new Uint8Array(arrayBuffer),
    });
    paynlDocumentId = remote.documentId ?? null;
    remoteStatus = mapRemoteDocStatus(remote.status);
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      // File is stored locally — keep it so the user can retry without re-uploading.
      console.error('[Alliance] Pay.nl document upload failed', {
        organizationId: id,
        documentCode,
        status: error.status,
      });
      return NextResponse.json(
        {
          error:
            'Stored locally but Pay.nl rejected the upload. ' +
            'Please verify the file and try again.',
        },
        { status: 502 },
      );
    }
    console.error('[Alliance] Unexpected error forwarding document', {
      organizationId: id,
      documentCode,
      error,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // ---- 3. Update the existing requested row --------------------------------
  const { data: updatedRow, error: updateError } = await supabaseAdmin
    .from('organization_kyc_documents')
    .update({
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      paynl_document_id: paynlDocumentId,
      status: remoteStatus,
      uploaded_by: auth.user?.id ?? null,
      uploaded_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', existingDoc.id)
    .select('id, doc_type, paynl_document_code, status, uploaded_at')
    .single();

  if (updateError || !updatedRow) {
    console.error('[Alliance] Failed to update document row after upload', {
      organizationId: id,
      documentCode,
      error: updateError?.message,
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
    id: updatedRow.id,
    documentCode: updatedRow.paynl_document_code,
    docType: updatedRow.doc_type,
    status: updatedRow.status,
    uploadedAt: updatedRow.uploaded_at,
    paynlDocumentId,
  });
}
