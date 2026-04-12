import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/kiosk-sessions/[id]/scanned
 *
 * Marks a kiosk session as scanned. Called by the donor's phone when
 * they land on the donation page after scanning the QR code.
 *
 * The kiosk tablet subscribes to Realtime changes on this row and
 * resets its UI as soon as status flips to 'scanned'.
 *
 * No auth required — public donation flow.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('kiosk_sessions')
    .update({ status: 'scanned' })
    .eq('id', id)
    .eq('status', 'waiting');

  if (error) {
    console.error('[KioskSessions] scanned update failed', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
