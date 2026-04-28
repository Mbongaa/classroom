import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * GET /api/organizations/[id]/merchant/agreement/download
 *
 * Streams back the signed agreement PDF for inspection. Resolves the most
 * recent agreement doc for the org (or a specific one via ?docId=), reads it
 * out of the private `kyc-documents` storage bucket, and serves it inline
 * with `application/pdf`.
 *
 * Auth: org admin or platform superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = 'kyc-documents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Resolve the agreement doc — either an explicit one (?docId=) or the
  // most recently signed agreement for this org.
  const docId = request.nextUrl.searchParams.get('docId');
  let query = supabaseAdmin
    .from('organization_kyc_documents')
    .select('id, storage_path, signed_at, signed_by, doc_type')
    .eq('organization_id', id)
    .eq('doc_type', 'agreement')
    .not('storage_path', 'is', null);

  if (docId) {
    if (!UUID_RE.test(docId)) {
      return NextResponse.json({ error: 'Invalid docId' }, { status: 400 });
    }
    query = query.eq('id', docId);
  }

  const { data: rows, error } = await query
    .order('signed_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[Agreement] Lookup failed', { organizationId: id, error: error.message });
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const row = rows?.[0];
  if (!row?.storage_path) {
    return NextResponse.json(
      { error: 'No signed agreement found for this organization yet.' },
      { status: 404 },
    );
  }

  const { data: file, error: dlError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(row.storage_path);

  if (dlError || !file) {
    console.error('[Agreement] Storage download failed', {
      organizationId: id,
      storagePath: row.storage_path,
      error: dlError?.message,
    });
    return NextResponse.json({ error: 'File not available' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `agreement-${id.slice(0, 8)}-${row.signed_at?.split('T')[0] ?? 'signed'}.pdf`;

  // `inline` so the browser previews it in a new tab; admin can still save.
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
