import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Fetch active sessions with their organization (direct FK relationship)
  const { data: dbSessions, error } = await supabaseAdmin
    .from('sessions')
    .select('id, room_sid, room_name, session_id, started_at, organization_id, organizations(name)')
    .is('ended_at', null)
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch live rooms from LiveKit for participant counts
  let liveRooms: { name: string; numParticipants: number; creationTime: number }[] = [];

  if (LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const rooms = await roomService.listRooms();
      liveRooms = rooms.map((r) => ({
        name: r.name,
        numParticipants: r.numParticipants,
        creationTime: Number(r.creationTime) * 1000, // Convert to ms
      }));
    } catch (err) {
      console.error('[Superadmin] Failed to fetch LiveKit rooms:', err);
    }
  }

  // Create a map of LiveKit rooms by name
  const liveRoomMap = new Map(liveRooms.map((r) => [r.name, r]));

  // Merge DB sessions with live data
  const sessions = (dbSessions ?? []).map((session: any) => {
    const org = session.organizations as { name: string } | null;
    return {
      id: session.id,
      room_name: session.room_name,
      session_id: session.session_id,
      started_at: session.started_at,
      organization: org?.name ?? null,
    };
  });

  // Also include any LiveKit rooms that don't have a DB session
  for (const liveRoom of liveRooms) {
    const hasDbSession = (dbSessions ?? []).some((s: any) => s.room_name === liveRoom.name);
    if (!hasDbSession) {
      sessions.push({
        id: null,
        room_name: liveRoom.name,
        session_id: null,
        started_at: new Date(liveRoom.creationTime).toISOString(),
        organization: null,
      });
    }
  }

  return NextResponse.json({ sessions });
}
