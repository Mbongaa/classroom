import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';

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
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

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

// ---------------------------------------------------------------------------
// Shared body validator (also used by the [campaignId] PATCH route)
// ---------------------------------------------------------------------------

interface ValidatedFields {
  fields: {
    slug?: string;
    title?: string;
    description?: string | null;
    goal_amount?: number | null;
    cause_type?: string | null;
    is_active?: boolean;
  };
}

export function validateCampaignBody(
  body: Record<string, unknown>,
  { mode }: { mode: 'create' | 'update' },
): ValidatedFields | { error: string } {
  const fields: ValidatedFields['fields'] = {};

  // title — required on create, optional on update
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { error: 'title must be a string' };
    }
    const trimmed = body.title.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      return { error: 'title must be 2-200 characters' };
    }
    fields.title = trimmed;
  } else if (mode === 'create') {
    return { error: 'title is required' };
  }

  // slug — required on create, optional on update
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      return { error: 'slug must be a string' };
    }
    const normalised = body.slug.trim().toLowerCase();
    if (!SLUG_RE.test(normalised)) {
      return {
        error:
          'slug must be 3-60 lowercase letters, numbers or hyphens, starting and ending with an alphanumeric character',
      };
    }
    fields.slug = normalised;
  } else if (mode === 'create') {
    return { error: 'slug is required' };
  }

  // description — optional, nullable
  if (body.description !== undefined) {
    if (body.description === null || body.description === '') {
      fields.description = null;
    } else if (typeof body.description !== 'string') {
      return { error: 'description must be a string or null' };
    } else {
      const trimmed = body.description.trim();
      if (trimmed.length > 5000) {
        return { error: 'description must be at most 5000 characters' };
      }
      fields.description = trimmed;
    }
  }

  // goal_amount — optional, nullable, integer cents (≥0). Accept either an
  // integer (already in cents) or a number we can floor.
  if (body.goal_amount !== undefined) {
    if (body.goal_amount === null || body.goal_amount === '') {
      fields.goal_amount = null;
    } else {
      const num = Number(body.goal_amount);
      if (!Number.isFinite(num) || num < 0) {
        return { error: 'goal_amount must be a non-negative number of cents (or null)' };
      }
      fields.goal_amount = Math.floor(num);
    }
  }

  // cause_type — optional, nullable free-text tag
  if (body.cause_type !== undefined) {
    if (body.cause_type === null || body.cause_type === '') {
      fields.cause_type = null;
    } else if (typeof body.cause_type !== 'string') {
      return { error: 'cause_type must be a string or null' };
    } else {
      const trimmed = body.cause_type.trim();
      if (trimmed.length > 50) {
        return { error: 'cause_type must be at most 50 characters' };
      }
      fields.cause_type = trimmed;
    }
  }

  // is_active — optional bool
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return { error: 'is_active must be a boolean' };
    }
    fields.is_active = body.is_active;
  }

  return { fields };
}
