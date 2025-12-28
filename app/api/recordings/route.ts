import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getRecordingsByOrganization, getRoomRecordings } from '@/lib/recording-utils';

/**
 * GET /api/recordings
 * List recordings for the authenticated user's organization
 * Query params:
 *   - roomName (optional): Filter by specific room
 *
 * SECURITY: Recordings are filtered by organization membership
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user, supabase } = auth;

  try {
    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: 'User profile or organization not found' },
        { status: 400 },
      );
    }

    const roomName = request.nextUrl.searchParams.get('roomName');

    let recordings;
    if (roomName) {
      // Filter by room name AND organization
      recordings = await getRoomRecordings(roomName, profile.organization_id);
    } else {
      // Get all recordings for the user's organization
      recordings = await getRecordingsByOrganization(profile.organization_id);
    }

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('[API Recordings] Failed to fetch recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
