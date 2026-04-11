import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

/**
 * PUT /api/organizations/[id]/campaigns/reorder
 *
 * Accepts an ordered array of campaign IDs and writes their position into
 * `sort_order`. Only campaigns belonging to this org are updated — any
 * foreign IDs in the array are silently ignored.
 *
 * Body: { campaign_ids: string[] }
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

  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as Record<string, unknown>).campaign_ids)
  ) {
    return NextResponse.json(
      { error: 'Body must contain a campaign_ids array' },
      { status: 400 },
    );
  }

  const campaignIds = (raw as { campaign_ids: unknown[] }).campaign_ids.filter(
    (v): v is string => typeof v === 'string' && UUID_RE.test(v),
  );

  if (campaignIds.length === 0) {
    return NextResponse.json({ error: 'No valid campaign IDs provided' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Update each campaign's sort_order based on its position in the array.
  // We scope every update to organization_id = id for defense in depth.
  const updates = campaignIds.map((campaignId, index) =>
    supabaseAdmin
      .from('campaigns')
      .update({ sort_order: index })
      .eq('id', campaignId)
      .eq('organization_id', id),
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error('[Campaigns] reorder failed', failed.map((r) => r.error));
    return NextResponse.json({ error: 'Failed to reorder some campaigns' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
