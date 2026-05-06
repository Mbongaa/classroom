import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateCampaignBody } from '../validate';

/**
 * /api/organizations/[id]/campaigns/[campaignId]
 *
 * PATCH  — update editable fields on a campaign (admin or teacher).
 * DELETE — delete a campaign (admin only).
 *
 * Both routes verify the campaign actually belongs to the org in the URL —
 * defense in depth on top of the RLS policies. Direct foreign-key violations
 * (campaign has transactions or mandates) are translated to a 409 with a
 * helpful message ("deactivate instead of deleting").
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPAIGN_COLUMNS =
  'id, organization_id, slug, title, description, goal_amount, cause_type, icon, is_active, sort_order, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string; campaignId: string }>;
}

// ---------------------------------------------------------------------------
// PATCH — update a campaign
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, campaignId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(campaignId)) {
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
  const body = raw as Record<string, unknown>;

  const validation = validateCampaignBody(body, { mode: 'update' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (Object.keys(validation.fields).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Defense in depth: verify the campaign belongs to this org before update.
  const { data: existing } = await supabaseAdmin
    .from('campaigns')
    .select('id, organization_id')
    .eq('id', campaignId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(validation.fields)
    .eq('id', campaignId)
    .eq('organization_id', id)
    .select(CAMPAIGN_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'A campaign with this slug already exists in this organization. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[Campaigns] update failed', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}

// ---------------------------------------------------------------------------
// DELETE — delete a campaign (admin only, blocked if linked to donations)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, campaignId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(campaignId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Verify ownership first.
  const { data: existing } = await supabaseAdmin
    .from('campaigns')
    .select('id, organization_id')
    .eq('id', campaignId)
    .single();
  if (!existing || existing.organization_id !== id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('organization_id', id);

  if (error) {
    // 23503 = foreign_key_violation. transactions.campaign_id and
    // mandates.campaign_id both use ON DELETE RESTRICT, so a campaign with
    // any linked donations or mandates cannot be hard-deleted.
    if ((error as { code?: string }).code === '23503') {
      return NextResponse.json(
        {
          error:
            'This campaign has donations or mandates linked to it and cannot be deleted. Deactivate it instead so it stops accepting new donations.',
        },
        { status: 409 },
      );
    }
    console.error('[Campaigns] delete failed', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
