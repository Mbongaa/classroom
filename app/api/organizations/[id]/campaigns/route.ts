import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { validateCampaignBody } from './validate';

/**
 * /api/organizations/[id]/campaigns
 *
 * GET  — list all campaigns for an org (active + inactive). Any org member
 *        can read. Used by the campaigns admin page.
 * POST — create a new campaign. Org admins or teachers only — matches the
 *        "Org admins can create campaigns" RLS policy on the table.
 *
 * The donate URL is `/donate/[org-slug]/[campaign-slug]`, so `slug` is the
 * URL-friendly identifier and is GLOBALLY UNIQUE (not per-org). We surface
 * a 409 with a clear message when a slug is already taken.
 *
 * Money fields (transactions) are intentionally NOT touched here — webhook
 * handlers are the only writers of donation state.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CampaignRow {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CAMPAIGN_COLUMNS =
  'id, organization_id, slug, title, description, goal_amount, cause_type, is_active, created_at, updated_at';

// ---------------------------------------------------------------------------
// GET — list campaigns for an org
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  // Any org member (including students) can read the list — the gate is
  // on writes only. Superadmins also pass via requireOrgAdmin.
  const auth = await requireOrgAdmin(id, ['admin', 'teacher', 'student']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select<string, CampaignRow>(CAMPAIGN_COLUMNS)
    .eq('organization_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Campaigns] list failed', error);
    return NextResponse.json({ error: 'Failed to load campaigns' }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST — create a campaign
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  // Matches the "Org admins can create campaigns" RLS policy.
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

  const validation = validateCampaignBody(body, { mode: 'create' });
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      organization_id: id,
      ...validation.fields,
    })
    .select<string, CampaignRow>(CAMPAIGN_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation. The only unique column on campaigns is `slug`.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'A campaign with this slug already exists. Pick another slug.' },
        { status: 409 },
      );
    }
    console.error('[Campaigns] create failed', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }

  return NextResponse.json({ campaign: data }, { status: 201 });
}

