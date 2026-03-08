import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/sessions/end
 * Sets ended_at on a session. Idempotent — no-ops if already ended.
 * Called from client on disconnect/page unload.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('ended_at', null)
      .select('id, session_id');

    if (error) {
      console.error('[Session End] Failed to end session:', error);
      return NextResponse.json(
        { error: `Failed to end session: ${error.message}` },
        { status: 500 },
      );
    }

    if (data && data.length > 0) {
      console.log(`[Session End] Ended session: ${data[0].session_id}`);
    } else {
      console.log(`[Session End] No active session found for sessionId: ${sessionId} (already ended or not found)`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Session End] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
