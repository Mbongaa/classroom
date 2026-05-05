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

// Auto-close any session whose translation agent has been silent this long.
// Mosques sometimes leave WebRTC running after a lecture ends — this kicks
// everyone and frees up LiveKit minutes.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * POST /api/v2/reaper  (also handles GET for Vercel cron)
 *
 * Periodic cleanup: validates every active/draining v2 session against LiveKit.
 * - If LiveKit room doesn't exist → end session
 * - If room exists with 0 participants → transition to draining → delete on next pass
 * - If agent has been silent (no translations/transcriptions) for >30 min → force-close
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
  if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    );
  }
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

        // ---- Inactivity check (agent silent for too long) -------------------
        // last_activity_at = MAX(started_at, latest translation, latest transcription)
        // Using started_at as the floor gives every new session a 30-min grace
        // window before it's eligible for the inactivity kill.
        const [latestTranslation, latestTranscription] = await Promise.all([
          supabase
            .from('v2_translation_entries')
            .select('created_at')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('v2_transcriptions')
            .select('created_at')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const candidateTimestamps = [
          new Date(session.started_at).getTime(),
          latestTranslation.data?.created_at
            ? new Date(latestTranslation.data.created_at).getTime()
            : 0,
          latestTranscription.data?.created_at
            ? new Date(latestTranscription.data.created_at).getTime()
            : 0,
        ];
        const lastActivityMs = Math.max(...candidateTimestamps);
        const idleMs = Date.now() - lastActivityMs;

        if (idleMs > INACTIVITY_TIMEOUT_MS) {
          const idleMinutes = Math.round(idleMs / 60000);
          console.log(
            `[V2 Reaper] Inactivity timeout for session ${session.id} ` +
              `(${idleMinutes}m silent) — force-closing room ${session.livekit_room_name}`,
          );
          // deleteRoom kicks every participant and removes the LiveKit room.
          // Wrap in try/catch so a missing room doesn't block ending the DB session.
          try {
            await deleteRoom(session.livekit_room_name, language);
          } catch (err) {
            console.warn(
              `[V2 Reaper] deleteRoom failed for ${session.livekit_room_name}:`,
              err,
            );
          }
          await markAllV2ParticipantsLeft(session.id);
          await updateV2SessionCounts(session.id, 0, 0);
          await transitionV2Session(session.id, 'ended', 'reaper');
          reaped++;
          continue;
        }

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
