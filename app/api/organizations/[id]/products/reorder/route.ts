import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * PUT /api/organizations/[id]/products/reorder
 *
 * Accepts `{ product_ids: string[] }` and maps each ID's position to its
 * sort_order value. Only updates products that belong to this org — any
 * foreign IDs in the array are silently ignored.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin', 'teacher']);
  if (!auth.success) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { product_ids } = raw as { product_ids?: unknown };
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return NextResponse.json({ error: 'product_ids must be a non-empty array' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Only update products belonging to this org.
  await Promise.all(
    product_ids.map((productId: string, index: number) => {
      if (!UUID_RE.test(productId)) return Promise.resolve();
      return supabaseAdmin
        .from('products')
        .update({ sort_order: index })
        .eq('id', productId)
        .eq('organization_id', id);
    }),
  );

  return NextResponse.json({ ok: true });
}
