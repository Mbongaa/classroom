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

  // Fetch all sessions with their organization (direct FK relationship)
  const { data: dbSessions, error } = await supabaseAdmin
    .from('sessions')
    .select('id, room_sid, room_name, session_id, started_at, ended_at, organization_id, organizations(name, slug)')
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch live rooms from LiveKit for participant counts
  let liveRooms: { name: string; sid: string; numParticipants: number; creationTime: number }[] = [];

  if (LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const rooms = await roomService.listRooms();
      liveRooms = rooms.map((r) => ({
        name: r.name,
        sid: r.sid,
        numParticipants: r.numParticipants,
        creationTime: Number(r.creationTime) * 1000, // Convert to ms
      }));
    } catch (err) {
      console.error('[Superadmin] Failed to fetch LiveKit rooms:', err);
    }
  }

  // Create a map of LiveKit rooms by name
  const liveRoomMap = new Map(liveRooms.map((r) => [r.name, r]));

  // Fetch classrooms to get room_type for each session
  const { data: classrooms } = await supabaseAdmin
    .from('classrooms')
    .select('room_code, organization_id, room_type');

  // Build lookup: "room_code|org_id" -> room_type, plus fallback by room_code only
  const classroomTypeMap = new Map<string, string>();
  for (const c of classrooms ?? []) {
    classroomTypeMap.set(`${c.room_code}|${c.organization_id}`, c.room_type);
    // Fallback key without org (for sessions without org)
    if (!classroomTypeMap.has(c.room_code)) {
      classroomTypeMap.set(c.room_code, c.room_type);
    }
  }

  // Merge DB sessions with live data
  const sessions = (dbSessions ?? []).map((session: any) => {
    const org = session.organizations as { name: string; slug: string } | null;
    const roomType = classroomTypeMap.get(`${session.room_name}|${session.organization_id}`)
      ?? classroomTypeMap.get(session.room_name)
      ?? null;
    return {
      id: session.id,
      room_name: session.room_name,
      session_id: session.session_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      organization: org?.name ?? null,
      organization_slug: org?.slug ?? null,
      room_type: roomType,
    };
  });

  // Also include any LiveKit rooms that don't have a DB session
  for (const liveRoom of liveRooms) {
    const hasDbSession = (dbSessions ?? []).some(
      (s: any) => s.room_name === liveRoom.name || s.room_sid === liveRoom.sid
    );
    if (!hasDbSession) {
      sessions.push({
        id: null,
        room_name: liveRoom.name,
        session_id: null,
        started_at: new Date(liveRoom.creationTime).toISOString(),
        ended_at: null,
        organization: null,
        organization_slug: null,
        room_type: classroomTypeMap.get(liveRoom.name) ?? null,
      });
    }
  }

  return NextResponse.json({ sessions });
}
