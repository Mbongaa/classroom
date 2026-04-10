import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';

/**
 * GET /api/sessions
 * Returns all sessions for the user's organization, with optional recording data.
 * Filters by matching session room_name against the org's classroom room_codes
 * (sessions store room_code like "MATH101" as room_name).
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user } = auth;
  const supabase = createAdminClient();

  // Get user's organization_id from profile. NOTE: superadmins legitimately
  // have organization_id = NULL (they don't belong to a tenant), so we can't
  // bail out on a null org until AFTER we've checked for an active
  // impersonation cookie below.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Honor superadmin "act as organization" impersonation. If active, the
  // superadmin sees the impersonated org's sessions instead of their own.
  // This must run before the null-org check so a superadmin with no home
  // org can still fetch sessions for the org they're impersonating.
  const actingAs = await resolveActingAsForUser(user.id);
  const organizationId = actingAs?.organizationId ?? profile.organization_id;

  if (!organizationId) {
    return NextResponse.json({ error: 'No organization in scope' }, { status: 404 });
  }

  // Get all classroom room_codes for this organization
  const { data: classrooms, error: classroomError } = await supabase
    .from('classrooms')
    .select('room_code')
    .eq('organization_id', organizationId);

  if (classroomError) {
    return NextResponse.json({ error: 'Failed to fetch classrooms' }, { status: 500 });
  }

  const roomCodes = classrooms?.map((c) => c.room_code) || [];

  if (roomCodes.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // Get sessions where room_name matches an org classroom's room_code
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id,
      room_name,
      room_sid,
      session_id,
      started_at,
      ended_at,
      session_recordings (
        id,
        status,
        hls_playlist_url,
        mp4_url,
        duration_seconds,
        teacher_name,
        livekit_egress_id
      )
    `)
    .in('room_name', roomCodes)
    .eq('organization_id', organizationId) // Scope to user's org (or impersonated org)
    .order('started_at', { ascending: false });

  if (sessionsError) {
    console.error('[Sessions API] Error fetching sessions:', sessionsError);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }

  // Transform: flatten recording data (take first real recording if any)
  const result = (sessions || []).map((session: any) => {
    const recordings = (session.session_recordings || []).filter(
      (r: any) => !r.livekit_egress_id?.startsWith('transcript-'),
    );
    const recording = recordings.length > 0 ? recordings[0] : null;

    return {
      id: session.id,
      room_name: session.room_name,
      session_id: session.session_id,
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
