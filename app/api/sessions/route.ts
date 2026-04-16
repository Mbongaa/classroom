import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';

/**
 * GET /api/sessions
 * Returns all sessions for the user's organization, with optional recording data.
 * Queries v2_sessions (source of truth) joined with classrooms for display names,
 * and matches recordings via room_sid.
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user } = auth;
  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Honor superadmin "act as organization" impersonation.
  const actingAs = await resolveActingAsForUser(user.id);
  const organizationId = actingAs?.organizationId ?? profile.organization_id;

  if (!organizationId) {
    return NextResponse.json({ error: 'No organization in scope' }, { status: 404 });
  }

  // Query v2_sessions for this org, joined with classroom for room_code display
  const { data: v2Sessions, error: sessionsError } = await supabase
    .from('v2_sessions')
    .select(`
      id,
      livekit_room_name,
      room_sid,
      state,
      started_at,
      ended_at,
      classrooms:classroom_id (
        room_code
      )
    `)
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false });

  if (sessionsError) {
    console.error('[Sessions API] Error fetching v2 sessions:', sessionsError);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  // Match recordings by room_sid (the LiveKit room SID links a session to its recording)
  const roomSids = (v2Sessions ?? [])
    .map((s: any) => s.room_sid)
    .filter((sid: string | null): sid is string => !!sid);

  const recordingsByRoomSid = new Map<string, any>();

  if (roomSids.length > 0) {
    const { data: recordings } = await supabase
      .from('session_recordings')
      .select(`
        id, status, hls_playlist_url, mp4_url,
        duration_seconds, teacher_name, livekit_egress_id, room_sid
      `)
      .in('room_sid', roomSids);

    for (const rec of recordings ?? []) {
      if (rec.room_sid && !rec.livekit_egress_id?.startsWith('transcript-')) {
        if (!recordingsByRoomSid.has(rec.room_sid)) {
          recordingsByRoomSid.set(rec.room_sid, rec);
        }
      }
    }
  }

  const result = (v2Sessions ?? []).map((session: any) => {
    const classroom = session.classrooms;
    const recording = session.room_sid
      ? recordingsByRoomSid.get(session.room_sid) ?? null
      : null;

    return {
      id: session.id,
      room_name: classroom?.room_code ?? session.livekit_room_name,
      session_id: session.id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      recording: recording
        ? {
            id: recording.id,
            status: recording.status,
            hls_playlist_url: recording.hls_playlist_url,
            mp4_url: recording.mp4_url,
            duration_seconds: recording.duration_seconds,
            teacher_name: recording.teacher_name,
          }
        : null,
    };
  });

  return NextResponse.json({ sessions: result });
}
