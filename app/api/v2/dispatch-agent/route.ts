import { NextRequest, NextResponse } from 'next/server';
import { getClassroomById } from '@/lib/classroom-utils';
import { dispatchAgentToRoom } from '@/lib/v2/livekit-helpers';

/**
 * POST /api/v2/dispatch-agent
 *
 * Failsafe endpoint: re-dispatches an agent to an existing LiveKit room.
 * Called by the client watchdog in SpeechTranslationPanel when no agent
 * appears within 10s of joining (covers race conditions, worker restarts,
 * dropped jobs, etc.).
 *
 * Re-dispatch is harmless: if the agent is already in the room it's a no-op,
 * if not it will join shortly. No auth required beyond what's already
 * implicit in being able to reach the room.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { classroomId } = body as { classroomId: string };

    if (!classroomId) {
      return NextResponse.json(
        { error: 'Missing required field: classroomId' },
        { status: 400 },
      );
    }

    const classroom = await getClassroomById(classroomId);
    if (!classroom) {
      return NextResponse.json(
        { error: `Classroom not found: ${classroomId}` },
        { status: 404 },
      );
    }

    const language = classroom.settings?.language || 'en';

    console.log(`[V2 Dispatch] Re-dispatching agent for classroom ${classroomId} (${language})`);

    const dispatch = await dispatchAgentToRoom(classroomId, language);

    return NextResponse.json({ success: true, dispatchId: dispatch?.id });
  } catch (error) {
    console.error('[V2 Dispatch] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
