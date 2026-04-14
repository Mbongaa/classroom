import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateProductBody } from '../validate';

/**
 * /api/organizations/[id]/products/[productId]
 *
 * PATCH  — update editable fields on a product (admin or teacher).
 * DELETE — delete a product (admin only).
 *
 * Both routes verify the product actually belongs to the org in the URL —
 * defense in depth on top of the RLS policies.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_COLUMNS =
  'id, organization_id, slug, title, description, price, category, image_url, stock, is_active, sort_order, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string; productId: string }>;
}

// ---------------------------------------------------------------------------
// PATCH — update a product
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, productId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
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
  const body = raw as Record<string, unknown>;

  const validation = validateProductBody(body, { mode: 'update' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (Object.keys(validation.fields).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Defense in depth: verify the product belongs to this org before update.
  const { data: existing } = await supabaseAdmin
    .from('products')
    .select('id, organization_id')
    .eq('id', productId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(validation.fields)
    .eq('id', productId)
    .eq('organization_id', id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'A product with this slug already exists. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[Products] update failed', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

// ---------------------------------------------------------------------------
// DELETE — delete a product (admin only)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, productId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Verify ownership first.
  const { data: existing } = await supabaseAdmin
    .from('products')
    .select('id, organization_id')
    .eq('id', productId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', id);

  if (error) {
    if ((error as { code?: string }).code === '23503') {
      return NextResponse.json(
        {
          error:
            'This product has orders linked to it and cannot be deleted. Deactivate it instead.',
        },
        { status: 409 },
      );
    }
    console.error('[Products] delete failed', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
