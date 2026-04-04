import { NextRequest, NextResponse } from 'next/server';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';
import { createClient } from '@/lib/supabase/server';
import { mintV2Token } from '@/lib/v2/session-utils';
import { getCredentialsForLanguage } from '@/lib/v2/livekit-helpers';

/**
 * POST /api/v2/refresh-token
 * Mint a fresh 30-min token for an existing v2 participant.
 * Called by client timer at ~25-min intervals.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, participantIdentity, participantName, role, orgSlug } = body as {
      roomCode: string;
      participantIdentity: string;
      participantName: string;
      role: 'teacher' | 'student';
      orgSlug?: string;
    };

    if (!roomCode || !participantIdentity || !participantName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: roomCode, participantIdentity, participantName, role' },
        { status: 400 },
      );
    }

    // Resolve org
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let organizationId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (profile) organizationId = profile.organization_id;
    }
    if (!organizationId && orgSlug) {
      const org = await getOrganizationBySlug(orgSlug);
      if (org) organizationId = org.id;
    }

    // Look up classroom for language-based credential routing
    const classroom = await getClassroomByRoomCode(roomCode, organizationId);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const language = classroom.settings?.language || 'en';
    const credentials = getCredentialsForLanguage(language);
    const livekitRoomName = classroom.id;

    const token = await mintV2Token(
      participantIdentity,
      participantName,
      livekitRoomName,
      role,
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
