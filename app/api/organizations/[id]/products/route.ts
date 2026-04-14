import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateProductBody } from './validate';

/**
 * /api/organizations/[id]/products
 *
 * GET  — list all products for an org (active + inactive). Any org member
 *        can read. Used by the products admin page.
 * POST — create a new product. Org admins or teachers only.
 *
 * The shop URL is `/shop/[org-slug]/[product-slug]`, so `slug` is the
 * URL-friendly identifier and is GLOBALLY UNIQUE (not per-org). We surface
 * a 409 with a clear message when a slug is already taken.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProductRow {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const PRODUCT_COLUMNS =
  'id, organization_id, slug, title, description, price, category, image_url, stock, is_active, sort_order, created_at, updated_at';

// ---------------------------------------------------------------------------
// GET — list products for an org
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin', 'teacher', 'student']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('products')
    .select<string, ProductRow>(PRODUCT_COLUMNS)
    .eq('organization_id', id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Products] list failed', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST — create a product
// ---------------------------------------------------------------------------

export async function POST(
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
  const body = raw as Record<string, unknown>;

  const validation = validateProductBody(body, { mode: 'create' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      organization_id: id,
      ...validation.fields,
    })
    .select<string, ProductRow>(PRODUCT_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'A product with this slug already exists. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[Products] create failed', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }

  return NextResponse.json({ product: data }, { status: 201 });
}
