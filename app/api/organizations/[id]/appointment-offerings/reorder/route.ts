import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * PUT /api/organizations/[id]/appointment-offerings/reorder
 *
 * Accepts `{ offering_ids: string[] }` and maps each ID's position to its
 * sort_order value. Only updates offerings that belong to this org — any
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

  const { offering_ids } = raw as { offering_ids?: unknown };
  if (!Array.isArray(offering_ids) || offering_ids.length === 0) {
    return NextResponse.json(
      { error: 'offering_ids must be a non-empty array' },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();

  await Promise.all(
    offering_ids.map((offeringId: string, index: number) => {
      if (!UUID_RE.test(offeringId)) return Promise.resolve();
      return supabaseAdmin
        .from('appointment_offerings')
        .update({ sort_order: index })
        .eq('id', offeringId)
        .eq('organization_id', id);
    }),
  );

  return NextResponse.json({ ok: true });
}
