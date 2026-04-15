import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateOfferingBody } from './validate';

/**
 * /api/organizations/[id]/appointment-offerings
 *
 * GET  — list all offerings for an org (active + inactive). Any org member
 *        can read; used by the appointments admin page.
 * POST — create a new offering. Org admins or teachers only.
 *
 * Slug is GLOBALLY UNIQUE (like products/campaigns). We surface 409 with
 * a clear message when a slug is already taken.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OfferingRow {
  id: string;
  organization_id: string;
  slug: string;
  sheikh_name: string;
  sheikh_email: string;
  sheikh_bio: string | null;
  sheikh_avatar_url: string | null;
  price: number;
  duration_minutes: number;
  location: string | null;
  timezone: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const OFFERING_COLUMNS =
  'id, organization_id, slug, sheikh_name, sheikh_email, sheikh_bio, sheikh_avatar_url, price, duration_minutes, location, timezone, is_active, sort_order, created_at, updated_at';

// ---------------------------------------------------------------------------
// GET — list offerings for an org
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
    .from('appointment_offerings')
    .select<string, OfferingRow>(OFFERING_COLUMNS)
    .eq('organization_id', id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AppointmentOfferings] list failed', error);
    return NextResponse.json({ error: 'Failed to load offerings' }, { status: 500 });
  }

  return NextResponse.json({ offerings: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST — create an offering
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

  const validation = validateOfferingBody(body, { mode: 'create' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('appointment_offerings')
    .insert({
      organization_id: id,
      ...validation.fields,
    })
    .select<string, OfferingRow>(OFFERING_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'An offering with this slug already exists. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[AppointmentOfferings] create failed', error);
    return NextResponse.json({ error: 'Failed to create offering' }, { status: 500 });
  }

  return NextResponse.json({ offering: data }, { status: 201 });
}
