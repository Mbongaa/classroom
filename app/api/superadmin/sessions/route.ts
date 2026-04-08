import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient } from 'livekit-server-sdk';

// Bayaan LiveKit (Arabic)
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Vertex LiveKit (non-Arabic)
const VERTEX_API_KEY = process.env.LIVEKIT_VERTEX_API_KEY;
const VERTEX_API_SECRET = process.env.LIVEKIT_VERTEX_API_SECRET;
const VERTEX_LIVEKIT_URL = process.env.LIVEKIT_VERTEX_URL;

interface LiveRoom {
  name: string;
  sid: string;
  numParticipants: number;
  creationTime: number;
  server: 'bayaan' | 'vertex';
}

async function fetchLiveRooms(): Promise<LiveRoom[]> {
  const out: LiveRoom[] = [];

  const servers: Array<{ url?: string; key?: string; secret?: string; tag: 'bayaan' | 'vertex' }> = [
    { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET, tag: 'bayaan' },
    { url: VERTEX_LIVEKIT_URL, key: VERTEX_API_KEY, secret: VERTEX_API_SECRET, tag: 'vertex' },
  ];

  await Promise.all(
    servers.map(async ({ url, key, secret, tag }) => {
      if (!url || !key || !secret) return;
      try {
        const svc = new RoomServiceClient(url, key, secret);
        const rooms = await svc.listRooms();
        for (const r of rooms) {
          out.push({
            name: r.name,
            sid: r.sid,
            numParticipants: r.numParticipants,
            creationTime: Number(r.creationTime) * 1000,
            server: tag,
          });
        }
      } catch (err) {
        console.error(`[Superadmin] Failed to list rooms on ${tag}:`, err);
      }
    }),
  );

  return out;
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // 1. Pull v2 sessions joined with classroom + organization context.
  //    v2_sessions is the source of truth in the v2 architecture.
  const { data: v2Sessions, error } = await supabaseAdmin
    .from('v2_sessions')
    .select(
      `
        id,
        livekit_room_name,
        room_sid,
        state,
        started_at,
        ended_at,
        organization_id,
        classroom_id,
        classrooms:classroom_id (
          room_code,
          room_type,
          organization_id,
          settings,
          organizations:organization_id ( name, slug )
        ),
        organization:organization_id ( name, slug )
      `,
    )
    .order('started_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[Superadmin Sessions] v2_sessions query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Pull live rooms from BOTH LiveKit servers (Bayaan + Vertex).
  //    LiveKit is the truth: a "DB-active" session whose room is gone is stale.
  const liveRooms = await fetchLiveRooms();
  const liveRoomByName = new Map(liveRooms.map((r) => [r.name, r]));

  // 3. Build the session entries.
  const sessions = (v2Sessions ?? []).map((row: any) => {
    const classroom = row.classrooms ?? null;
    // Prefer org explicitly set on the session; fall back to classroom's org.
    const org =
      row.organization ??
      classroom?.organizations ??
      null;

    // Display name: use the human-readable room_code, fall back to LiveKit name.
    const displayName: string = classroom?.room_code ?? row.livekit_room_name;

    // True liveness: state must be active/draining AND room must exist in LiveKit.
    const dbActive = row.state === 'active' || row.state === 'draining';
    const liveRoom = liveRoomByName.get(row.livekit_room_name);
    const isLive = dbActive && !!liveRoom;

    // If the DB still says active but LiveKit has no room, treat as ended at started_at + duration
    // we don't know — so show ended_at = started_at to give "0m" duration and "Ended" badge.
    // (The reaper will mark these properly on its next pass; we don't write here.)
    const endedAt = isLive ? null : row.ended_at ?? row.started_at;

    return {
      id: row.id,
      room_name: displayName,
      livekit_room_name: row.livekit_room_name,
      session_id: row.id,
      started_at: row.started_at,
      ended_at: endedAt,
      organization: org?.name ?? null,
      organization_slug: org?.slug ?? null,
      room_type: (classroom?.room_type ?? null) as 'meeting' | 'classroom' | 'speech' | null,
      stale: dbActive && !isLive, // for debugging / future UI
    };
  });

  // 4. Append any LiveKit live rooms that don't have a v2_session row (orphans).
  //    These can appear if a room was created outside the v2 connect flow,
  //    or if the v2 row insert failed. Useful for the admin to see + clean up.
  const knownLiveKitNames = new Set((v2Sessions ?? []).map((s: any) => s.livekit_room_name));
  for (const live of liveRooms) {
    if (knownLiveKitNames.has(live.name)) continue;
    sessions.push({
      id: null,
      room_name: live.name,
      livekit_room_name: live.name,
      session_id: null,
      started_at: new Date(live.creationTime).toISOString(),
      ended_at: null,
      organization: null,
      organization_slug: null,
      room_type: null,
      stale: false,
    });
  }

  return NextResponse.json({ sessions });
}
