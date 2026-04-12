import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/kiosk-sessions
 *
 * Creates a new kiosk session. Called by the kiosk tablet when a donor
 * taps "One-time donation". Returns the session ID which is embedded
 * into the QR code URL.
 *
 * No auth required — the kiosk runs on a public donate page.
 *
 * Body: { organization_id: string, campaign_slug: string }
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
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
  const organizationId = body.organization_id;
  const campaignSlug = body.campaign_slug;

  if (typeof organizationId !== 'string' || !UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: 'Invalid organization_id' }, { status: 400 });
  }
  if (typeof campaignSlug !== 'string' || campaignSlug.length === 0) {
    return NextResponse.json({ error: 'campaign_slug is required' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('kiosk_sessions')
    .insert({ organization_id: organizationId, campaign_slug: campaignSlug })
    .select('id')
    .single();

  if (error) {
    console.error('[KioskSessions] create failed', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
