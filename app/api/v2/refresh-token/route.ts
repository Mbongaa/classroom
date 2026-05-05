import { NextRequest, NextResponse } from 'next/server';
import { getClassroomById } from '@/lib/classroom-utils';
import {
  getV2ParticipantByIdentity,
  getV2SessionById,
  mintV2Token,
} from '@/lib/v2/session-utils';
import { getCredentialsForLanguage } from '@/lib/v2/livekit-helpers';

const RECENT_LEAVE_REFRESH_GRACE_MS = 5 * 60 * 1000;

/**
 * POST /api/v2/refresh-token
 *
 * Guarded fallback only. Normal connected LiveKit clients receive reconnect
 * tokens from LiveKit internally; fresh app tokens should usually come from
 * /api/v2/connect when the user re-enters the room.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, participantIdentity } = body as {
      sessionId?: string;
      participantIdentity?: string;
    };

    if (!sessionId || !participantIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, participantIdentity' },
        { status: 400 },
      );
    }

    const session = await getV2SessionById(sessionId);
    if (!session || !['active', 'draining'].includes(session.state)) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 409 });
    }

    const participant = await getV2ParticipantByIdentity(session.id, participantIdentity);
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found in session' }, { status: 404 });
    }

    if (participant.role !== 'teacher' && participant.role !== 'student') {
      return NextResponse.json({ error: 'Participant role cannot be refreshed' }, { status: 403 });
    }

    if (!participant.is_active) {
      const leftAt = participant.left_at ? new Date(participant.left_at).getTime() : 0;
      if (!leftAt || Date.now() - leftAt > RECENT_LEAVE_REFRESH_GRACE_MS) {
        return NextResponse.json({ error: 'Participant is no longer active' }, { status: 409 });
      }
    }

    const classroom = await getClassroomById(session.classroom_id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const language = classroom.settings?.language || 'en';
    const credentials = getCredentialsForLanguage(language);
    const token = await mintV2Token(
      participant.identity,
      participant.name,
      session.livekit_room_name,
      participant.role,
      credentials,
      '30m',
    );

    return NextResponse.json({ participantToken: token });
  } catch (error) {
    console.error('[V2 Refresh] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
