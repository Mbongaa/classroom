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

interface ClassroomLookup {
  id: string;
  room_code: string;
  room_type: 'meeting' | 'classroom' | 'speech' | null;
  organization: { name: string | null; slug: string | null } | null;
}

/**
 * Resolve a LiveKit room name back to its classroom row.
 *
 * v2 uses classroom.id (UUID) as the LiveKit room name. Legacy rooms used
 * classrooms.room_code. We try the UUID match first, and only fall back to
 * room_code if the value isn't a UUID at all (saves a wasted query for the
 * common v2 case).
 */
async function resolveClassroomForLiveRoom(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  livekitRoomName: string,
): Promise<ClassroomLookup | null> {
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(livekitRoomName);

  const baseSelect = 'id, room_code, room_type, organizations:organization_id (name, slug)';

  if (looksLikeUuid) {
    const { data } = await supabaseAdmin
      .from('classrooms')
      .select(baseSelect)
      .eq('id', livekitRoomName)
      .maybeSingle();
    if (data) return normalizeClassroomLookup(data);
  }

  const { data: byCode } = await supabaseAdmin
    .from('classrooms')
    .select(baseSelect)
    .eq('room_code', livekitRoomName)
    .maybeSingle();
  if (byCode) return normalizeClassroomLookup(byCode);

  return null;
}

function normalizeClassroomLookup(row: any): ClassroomLookup {
  // organizations may come back as an object or single-element array depending
  // on the join cardinality PostgREST inferred. Normalize to a flat object.
  const orgRaw = row.organizations;
  const org = Array.isArray(orgRaw) ? (orgRaw[0] ?? null) : (orgRaw ?? null);
  return {
    id: row.id,
    room_code: row.room_code,
    room_type: row.room_type ?? null,
    organization: org ? { name: org.name ?? null, slug: org.slug ?? null } : null,
  };
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

  // 3. Build session entries from v2_sessions rows.
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
      // Language drives which LiveKit server (Bayaan vs Vertex) the close
      // endpoint targets — Arabic → Bayaan, everything else → Vertex.
      language: (classroom?.settings?.language ?? 'en') as string,
      stale: dbActive && !isLive, // for debugging / future UI
      orphan: false,
    };
  });

  // 4. Append any LiveKit live rooms that don't have a v2_session row (orphans).
  //
  //    Orphans appear when:
  //      a) A legacy LiveKit room (named after room_code, not classroom.id) is still
  //         alive from before the v2 cutover. Reaped automatically by /api/v2/connect
  //         when the next v2 join lands, but visible here in the meantime.
  //      b) A LiveKit room was created out-of-band (not via /api/v2/connect).
  //      c) The v2_sessions insert failed but the LiveKit room creation succeeded.
  //
  //    We try to attribute each orphan to a classroom (by classroom.id, then room_code)
  //    so the org column is populated and the row links back to a real entity. We do
  //    NOT use LiveKit's creationTime as Started At — for persistent rooms it's the
  //    time the LiveKit room object was first created, not the current call's start.
  //    Instead we look up the most recent v2_sessions row for the same classroom and
  //    use its started_at, falling back to creationTime only if absolutely nothing
  //    else exists.
  const knownLiveKitNames = new Set((v2Sessions ?? []).map((s: any) => s.livekit_room_name));
  const orphanLiveRooms = liveRooms.filter((r) => !knownLiveKitNames.has(r.name));

  // Resolve all orphan classrooms in parallel.
  const orphanClassrooms = await Promise.all(
    orphanLiveRooms.map((live) => resolveClassroomForLiveRoom(supabaseAdmin, live.name)),
  );

  // Batch-fetch the most recent v2_session per resolved classroom (any state).
  const classroomIds = Array.from(
    new Set(orphanClassrooms.filter((c): c is ClassroomLookup => !!c).map((c) => c.id)),
  );

  const lastSessionByClassroomId = new Map<
    string,
    { started_at: string; ended_at: string | null }
  >();

  if (classroomIds.length > 0) {
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from('v2_sessions')
      .select('classroom_id, started_at, ended_at')
      .in('classroom_id', classroomIds)
      .order('started_at', { ascending: false });

    if (recentErr) {
      console.error('[Superadmin Sessions] recent v2_sessions lookup failed:', recentErr);
    } else if (recent) {
      for (const row of recent) {
        if (!lastSessionByClassroomId.has(row.classroom_id)) {
          lastSessionByClassroomId.set(row.classroom_id, {
            started_at: row.started_at,
            ended_at: row.ended_at,
          });
        }
      }
    }
  }

  for (let i = 0; i < orphanLiveRooms.length; i++) {
    const live = orphanLiveRooms[i];
    const classroom = orphanClassrooms[i];
    const lastSession = classroom ? lastSessionByClassroomId.get(classroom.id) ?? null : null;

    // Started At preference order:
    //   1. The most recent v2_session row for this classroom (real call start time)
    //   2. LiveKit room creationTime (only meaningful for rooms that aren't persistent)
    const startedAt =
      lastSession?.started_at ?? new Date(live.creationTime).toISOString();

    sessions.push({
      id: null,
      room_name: classroom?.room_code ?? live.name,
      livekit_room_name: live.name,
      session_id: null,
      started_at: startedAt,
      ended_at: null,
      organization: classroom?.organization?.name ?? null,
      organization_slug: classroom?.organization?.slug ?? null,
      room_type: classroom?.room_type ?? null,
      // We know the server tag from fetchLiveRooms: bayaan = Arabic.
      // This lets the close endpoint pick the right LiveKit credentials
      // even when there's no v2_session row to read settings from.
      language: live.server === 'bayaan' ? 'ar' : 'en',
      stale: false,
      orphan: true,
    });
  }

  return NextResponse.json({ sessions });
}
