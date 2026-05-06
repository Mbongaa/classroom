import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateAvailabilityRules } from '../../validate';

/**
 * /api/organizations/[id]/appointment-offerings/[offeringId]/availability
 *
 * GET — list all availability rules for an offering.
 * PUT — replace the entire rule set in one transaction. Accepts
 *       `{ rules: Rule[] }` with kind='weekly' or 'date_override'.
 *
 * This endpoint uses replace-all semantics (not individual CRUD) because
 * the admin UI edits all rules together in a single form.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: Promise<{ id: string; offeringId: string }>;
}

const RULE_COLUMNS =
  'id, offering_id, kind, day_of_week, specific_date, start_time, end_time, is_blocking, created_at';

// ---------------------------------------------------------------------------
// GET — list availability rules
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id, offeringId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  const { data: offering } = await supabaseAdmin
    .from('appointment_offerings')
    .select('id, organization_id')
    .eq('id', offeringId)
    .single();
  if (!offering || offering.organization_id !== id) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('appointment_availability_rules')
    .select(RULE_COLUMNS)
    .eq('offering_id', offeringId)
    .order('kind', { ascending: true })
    .order('day_of_week', { ascending: true })
    .order('specific_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[AppointmentAvailability] list failed', error);
    return NextResponse.json({ error: 'Failed to load availability rules' }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

// ---------------------------------------------------------------------------
// PUT — replace all availability rules for the offering
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, offeringId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
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
  const { rules } = raw as { rules?: unknown };

  const validation = validateAvailabilityRules(rules);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: offering } = await supabaseAdmin
    .from('appointment_offerings')
    .select('id, organization_id')
    .eq('id', offeringId)
    .single();
  if (!offering || offering.organization_id !== id) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  // Replace-all: delete existing rules, then insert new ones.
  const { error: deleteError } = await supabaseAdmin
    .from('appointment_availability_rules')
    .delete()
    .eq('offering_id', offeringId);
  if (deleteError) {
    console.error('[AppointmentAvailability] replace/delete failed', deleteError);
    return NextResponse.json({ error: 'Failed to replace availability rules' }, { status: 500 });
  }

  if (validation.rules.length > 0) {
    const rows = validation.rules.map((r) => ({ ...r, offering_id: offeringId }));
    const { error: insertError } = await supabaseAdmin
      .from('appointment_availability_rules')
      .insert(rows);
    if (insertError) {
      console.error('[AppointmentAvailability] replace/insert failed', insertError);
      return NextResponse.json(
        { error: 'Failed to replace availability rules' },
        { status: 500 },
      );
    }
  }

  const { data: saved } = await supabaseAdmin
    .from('appointment_availability_rules')
    .select(RULE_COLUMNS)
    .eq('offering_id', offeringId)
    .order('kind', { ascending: true })
    .order('day_of_week', { ascending: true })
    .order('specific_date', { ascending: true })
    .order('start_time', { ascending: true });

  return NextResponse.json({ rules: saved ?? [] });
}
