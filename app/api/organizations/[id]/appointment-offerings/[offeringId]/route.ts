import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateOfferingBody } from '../validate';

/**
 * /api/organizations/[id]/appointment-offerings/[offeringId]
 *
 * PATCH  — update editable fields on an offering (admin or teacher).
 * DELETE — delete an offering (admin only). 409 if it has appointments
 *          linked via ON DELETE RESTRICT.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OFFERING_COLUMNS =
  'id, organization_id, slug, sheikh_name, sheikh_email, sheikh_bio, sheikh_avatar_url, price, duration_minutes, location, timezone, is_active, sort_order, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string; offeringId: string }>;
}

// ---------------------------------------------------------------------------
// PATCH — update an offering
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, offeringId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(offeringId)) {
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

  const validation = validateOfferingBody(body, { mode: 'update' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (Object.keys(validation.fields).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Defense in depth: verify the offering belongs to this org.
  const { data: existing } = await supabaseAdmin
    .from('appointment_offerings')
    .select('id, organization_id')
    .eq('id', offeringId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('appointment_offerings')
    .update(validation.fields)
    .eq('id', offeringId)
    .eq('organization_id', id)
    .select(OFFERING_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'An offering with this slug already exists. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[AppointmentOfferings] update failed', error);
    return NextResponse.json({ error: 'Failed to update offering' }, { status: 500 });
  }

  return NextResponse.json({ offering: data });
}

// ---------------------------------------------------------------------------
// DELETE — delete an offering (admin only)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, offeringId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: existing } = await supabaseAdmin
    .from('appointment_offerings')
    .select('id, organization_id')
    .eq('id', offeringId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('appointment_offerings')
    .delete()
    .eq('id', offeringId)
    .eq('organization_id', id);

  if (error) {
    if ((error as { code?: string }).code === '23503') {
      return NextResponse.json(
        {
          error:
            'This offering has appointments linked to it and cannot be deleted. Deactivate it instead.',
        },
        { status: 409 },
      );
    }
    console.error('[AppointmentOfferings] delete failed', error);
    return NextResponse.json({ error: 'Failed to delete offering' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
