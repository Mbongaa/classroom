import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * GET /api/organizations/[id]/appointments
 *
 * Lists all appointments for an organization. Any org member can read.
 * Supports optional filters:
 *   - status=pending|confirmed|cancelled|completed
 *   - offering_id=<uuid>
 *   - from=<ISO date>  (appointments scheduled on/after)
 *   - to=<ISO date>    (appointments scheduled on/before)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed']);

const APPOINTMENT_COLUMNS = `
  id,
  offering_id,
  organization_id,
  scheduled_at,
  duration_minutes,
  customer_name,
  customer_email,
  customer_phone,
  notes,
  transaction_id,
  status,
  confirmed_at,
  cancelled_at,
  created_at,
  updated_at,
  offering:appointment_offerings!appointments_offering_id_fkey (
    id, sheikh_name, slug, price
  )
`;

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

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const offeringFilter = url.searchParams.get('offering_id');
  const fromFilter = url.searchParams.get('from');
  const toFilter = url.searchParams.get('to');

  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('organization_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(500);

  if (statusFilter && VALID_STATUSES.has(statusFilter)) {
    query = query.eq('status', statusFilter);
  }
  if (offeringFilter && UUID_RE.test(offeringFilter)) {
    query = query.eq('offering_id', offeringFilter);
  }
  if (fromFilter) {
    query = query.gte('scheduled_at', fromFilter);
  }
  if (toFilter) {
    query = query.lte('scheduled_at', toFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Appointments] list failed', error);
    return NextResponse.json({ error: 'Failed to load appointments' }, { status: 500 });
  }

  return NextResponse.json({ appointments: data ?? [] });
}
