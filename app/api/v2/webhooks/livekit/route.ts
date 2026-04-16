import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  transitionV2Session,
  setV2SessionRoomSid,
  upsertV2Participant,
  markV2ParticipantLeft,
  markAllV2ParticipantsLeft,
  getV2ParticipantCounts,
  updateV2SessionCounts,
} from '@/lib/v2/session-utils';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const VERTEX_API_KEY = process.env.LIVEKIT_VERTEX_API_KEY;
const VERTEX_API_SECRET = process.env.LIVEKIT_VERTEX_API_SECRET;

/**
 * Validate webhook signature from either Bayaan or Vertex LiveKit server.
 */
async function validateWebhookSignature(
  body: string,
  authHeader: string | null,
): Promise<any | null> {
  const receivers: WebhookReceiver[] = [];

  if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
    receivers.push(new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET));
  }
  if (VERTEX_API_KEY && VERTEX_API_SECRET) {
    receivers.push(new WebhookReceiver(VERTEX_API_KEY, VERTEX_API_SECRET));
  }

  if (receivers.length === 0) {
    console.warn('[V2 Webhook] No API credentials — skipping signature validation');
    return JSON.parse(body);
  }

  for (const receiver of receivers) {
    try {
      return await receiver.receive(body, authHeader || undefined);
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find the v2 session matching a LiveKit room name.
 * Returns null if this room isn't managed by v2 (lets v1 handler take it).
 */
async function findV2SessionByRoomName(roomName: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('v2_sessions')
    .select('*')
    .eq('livekit_room_name', roomName)
    .in('state', ['active', 'draining'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/**
 * Determine if a participant is human or agent based on ParticipantInfo.
 * Protocol enum: STANDARD=0, INGRESS=1, EGRESS=2, SIP=3, AGENT=4
 */
function isAgent(participant: any): boolean {
  return participant?.kind === 4 || participant?.kind === 'AGENT';
}

/**
 * POST /api/v2/webhooks/livekit
 *
 * Handles room + participant lifecycle events for v2 sessions.
 * Events for rooms not in v2_sessions are ignored (200 OK) so v1 can handle them.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const authHeader = request.headers.get('Authorization');

    const event = await validateWebhookSignature(body, authHeader);
    if (!event) {
      console.error('[V2 Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { event: eventType, room, participant } = event;
    const roomName = room?.name;

    if (!roomName) {
      return NextResponse.json({ message: 'No room name in event' }, { status: 200 });
    }

    // Check if this room belongs to a v2 session
    const session = await findV2SessionByRoomName(roomName);
    if (!session) {
      // Not a v2 room — ignore silently (v1 handler processes it)
      return NextResponse.json({ message: 'Not a v2 session' }, { status: 200 });
    }

    console.log(`[V2 Webhook] ${eventType} for session ${session.id} (room: ${roomName})`);

    switch (eventType) {
      case 'room_started': {
        if (room?.sid) {
          await setV2SessionRoomSid(session.id, room.sid);
          console.log(`[V2 Webhook] Set room_sid=${room.sid} on session ${session.id}`);
        }
        break;
      }

      case 'participant_joined': {
        if (!participant) break;

        const agent = isAgent(participant);
        const role = agent ? 'agent' : 'student'; // webhook doesn't know teacher vs student
        const identity = participant.identity || `unknown_${Date.now()}`;
        const name = participant.name || identity;

        // Determine role from identity prefix if possible
        let resolvedRole = role;
        if (identity.startsWith('teacher:')) resolvedRole = 'teacher';
        else if (identity.startsWith('student:')) resolvedRole = 'student';
        else if (identity.startsWith('translator:')) resolvedRole = 'translator';
        else if (agent) resolvedRole = 'agent';

        await upsertV2Participant(session.id, identity, name, resolvedRole);

        // Update counts
        const counts = await getV2ParticipantCounts(session.id);
        await updateV2SessionCounts(session.id, counts.humanCount, counts.agentCount);

        // If session was draining and a human joined, reactivate
        if (!agent && session.state === 'draining') {
          await transitionV2Session(session.id, 'active');
        }

        console.log(
          `[V2 Webhook] ${resolvedRole} joined: ${identity} (humans: ${counts.humanCount}, agents: ${counts.agentCount})`,
        );
        break;
      }

      case 'participant_left': {
        if (!participant) break;

        const identity = participant.identity || '';
        await markV2ParticipantLeft(session.id, identity);

        // Update counts
        const counts = await getV2ParticipantCounts(session.id);
        await updateV2SessionCounts(session.id, counts.humanCount, counts.agentCount);

        // If no humans left → draining
        if (counts.humanCount === 0 && session.state === 'active') {
          await transitionV2Session(session.id, 'draining');
          console.log(`[V2 Webhook] Last human left → session ${session.id} draining`);
        }

        console.log(
          `[V2 Webhook] Participant left: ${identity} (humans: ${counts.humanCount}, agents: ${counts.agentCount})`,
        );
        break;
      }

      case 'room_finished': {
        await markAllV2ParticipantsLeft(session.id);
        await updateV2SessionCounts(session.id, 0, 0);
        await transitionV2Session(session.id, 'ended', 'room_finished');
        console.log(`[V2 Webhook] Room finished → session ${session.id} ended`);
        break;
      }

      default:
        console.log(`[V2 Webhook] Ignoring event: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[V2 Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
