import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { deleteRoom } from '@/lib/v2/livekit-helpers';
import {
  transitionV2Session,
  markAllV2ParticipantsLeft,
  updateV2SessionCounts,
} from '@/lib/v2/session-utils';

/**
 * POST /api/superadmin/sessions/close
 *
 * Forcibly close a session from the superadmin UI.
 *
 * Performs (whichever apply, in order):
 *   1. Delete the LiveKit room — disconnects every participant immediately.
 *   2. Mark all v2_participants for the session as left.
 *   3. Transition the v2_sessions row to 'ended' (reason: manual_close_superadmin).
 *
 * The handler accepts three combinations:
 *   - active session  → { sessionId, livekitRoomName, language }   (does all three)
 *   - orphan room     → { livekitRoomName, language }              (LiveKit only)
 *   - stale session   → { sessionId }                              (DB only — room is already gone)
 *
 * Either `sessionId` or `livekitRoomName` must be present. The handler is
 * tolerant of "room not found" errors — those mean the room is already gone,
 * which is the desired end state.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  let body: {
    sessionId?: string | null;
    livekitRoomName?: string | null;
    language?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, livekitRoomName, language } = body;

  if (!sessionId && !livekitRoomName) {
    return NextResponse.json(
      { error: 'Must provide sessionId or livekitRoomName' },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  let livekitDeleted = false;
  let sessionEnded = false;

  // Step 1: kill the LiveKit room (disconnects every participant).
  // Best-effort — a missing room is treated as success since the desired end
  // state (room gone) is already met.
  if (livekitRoomName) {
    const lang = language || 'en';
    try {
      await deleteRoom(livekitRoomName, lang);
      livekitDeleted = true;
      console.log(
        `[Superadmin Close] Deleted LiveKit room "${livekitRoomName}" on ${lang === 'ar' ? 'Bayaan' : 'Vertex'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/not.?found|does not exist|no such room/i.test(message)) {
        livekitDeleted = true;
      } else {
        console.error('[Superadmin Close] deleteRoom failed:', err);
        errors.push(`deleteRoom: ${message}`);
      }
    }
  }

  // Step 2: end the v2_sessions row + participants (only for tracked sessions).
  if (sessionId) {
    try {
      await markAllV2ParticipantsLeft(sessionId);
      await updateV2SessionCounts(sessionId, 0, 0);
      // transitionV2Session returns false when the session was already in a
      // terminal state — that's still a successful "close" outcome.
      const transitioned = await transitionV2Session(
        sessionId,
        'ended',
        'manual_close_superadmin',
      );
      sessionEnded = true;
      if (!transitioned) {
        console.log(
          `[Superadmin Close] Session ${sessionId} was already in a terminal state`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Superadmin Close] DB cleanup failed:', err);
      errors.push(`session: ${message}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, livekitDeleted, sessionEnded, errors },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, livekitDeleted, sessionEnded });
}
