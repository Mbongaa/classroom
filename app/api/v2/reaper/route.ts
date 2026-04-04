import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  transitionV2Session,
  markAllV2ParticipantsLeft,
  updateV2SessionCounts,
} from '@/lib/v2/session-utils';
import {
  getCredentialsForLanguage,
  verifyRoomExists,
  deleteRoom,
  listRoomParticipants,
} from '@/lib/v2/livekit-helpers';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/v2/reaper  (also handles GET for Vercel cron)
 *
 * Periodic cleanup: validates every active/draining v2 session against LiveKit.
 * - If LiveKit room doesn't exist → end session
 * - If room exists with 0 participants for >5 min → delete room, end session
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  return handleReaper(request);
}

export async function GET(request: NextRequest) {
  return handleReaper(request);
}

async function handleReaper(request: NextRequest) {
  // Validate cron secret
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();

    // Fetch all active/draining sessions
    const { data: sessions, error } = await supabase
      .from('v2_sessions')
      .select('id, livekit_room_name, classroom_id, state, started_at')
      .in('state', ['active', 'draining']);

    if (error) {
      console.error('[V2 Reaper] Error fetching sessions:', error);
      return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No active sessions', reaped: 0 });
    }

    console.log(`[V2 Reaper] Checking ${sessions.length} active/draining sessions`);

    let reaped = 0;

    for (const session of sessions) {
      try {
        // Look up classroom to determine language → correct credentials
        const { data: classroom } = await supabase
          .from('classrooms')
          .select('settings')
          .eq('id', session.classroom_id)
          .single();

        const language = classroom?.settings?.language || 'en';

        // Check LiveKit room state
        const room = await verifyRoomExists(session.livekit_room_name, language);

        if (!room) {
          // Room doesn't exist in LiveKit → end session
          console.log(`[V2 Reaper] Room gone for session ${session.id} — ending`);
          await markAllV2ParticipantsLeft(session.id);
          await updateV2SessionCounts(session.id, 0, 0);
          await transitionV2Session(session.id, 'ended', 'reaper');
          reaped++;
          continue;
        }

        // Room exists — check participant count
        try {
          const participants = await listRoomParticipants(
            session.livekit_room_name,
            language,
          );

          if (participants.length === 0) {
            // Room exists but empty for some time — check if draining long enough
            if (session.state === 'draining') {
              // Empty + draining → clean up
              console.log(`[V2 Reaper] Empty draining room for session ${session.id} — cleaning`);
              await deleteRoom(session.livekit_room_name, language);
              await markAllV2ParticipantsLeft(session.id);
              await updateV2SessionCounts(session.id, 0, 0);
              await transitionV2Session(session.id, 'ended', 'reaper');
              reaped++;
            } else {
              // Active but empty — transition to draining first
              console.log(`[V2 Reaper] Empty active room for session ${session.id} — marking draining`);
              await markAllV2ParticipantsLeft(session.id);
              await updateV2SessionCounts(session.id, 0, 0);
              await transitionV2Session(session.id, 'draining');
            }
          }
        } catch (err) {
          // listParticipants can fail if room just ended
          console.warn(`[V2 Reaper] Error checking participants for session ${session.id}:`, err);
        }
      } catch (err) {
        console.error(`[V2 Reaper] Error processing session ${session.id}:`, err);
      }
    }

    console.log(`[V2 Reaper] Done. Reaped ${reaped}/${sessions.length} sessions.`);
    return NextResponse.json({
      message: 'Reaper complete',
      checked: sessions.length,
      reaped,
    });
  } catch (error) {
    console.error('[V2 Reaper] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
