import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const COOKIE_KEY = 'random-participant-postfix';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');

    // NEW: Check if this is a classroom or speech session and what role
    const isClassroom = request.nextUrl.searchParams.get('classroom') === 'true';
    const isSpeech = request.nextUrl.searchParams.get('speech') === 'true';
    const role = request.nextUrl.searchParams.get('role') ?? 'student'; // 'teacher' or 'student'

    // SUPABASE AUTH CHECK - Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Optional: Require authentication for classroom sessions
    // Uncomment this block to enforce auth for classrooms
    // if (isClassroom && !user) {
    //   return new NextResponse('Authentication required for classroom sessions', { status: 401 });
    // }

    // If user is authenticated, get their profile and verify permissions
    let userRole = role; // Default to query param role
    if (user && isClassroom) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        // If user is authenticated, use their actual role from the database
        // Teachers and admins get teacher privileges
        if (profile.role === 'teacher' || profile.role === 'admin') {
          userRole = 'teacher';
        } else {
          userRole = 'student';
        }

        // Optional: Verify user is part of the classroom
        // Check if classroom exists and user has access
        const { data: classroom } = await supabase
          .from('classrooms')
          .select('id, organization_id')
          .eq('room_code', roomName)
          .eq('organization_id', profile.organization_id)
          .single();

        if (classroom) {
          // Log participation for analytics
          await supabase.from('classroom_participants').upsert(
            {
              classroom_id: classroom.id,
              user_id: user.id,
              role: userRole,
              last_attended_at: new Date().toISOString(),
            },
            {
              onConflict: 'classroom_id,user_id',
            },
          );
        }
      }
    }

    if (!LIVEKIT_URL) {
      return NextResponse.json({ error: 'LIVEKIT_URL is not configured' }, { status: 500 });
    }
    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
    }

    if (typeof roomName !== 'string') {
      return new NextResponse('Missing required query parameter: roomName', { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse('Missing required query parameter: participantName', { status: 400 });
    }

    // Generate participant token
    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(4);
    }

    // Add role to metadata for client-side use
    const enrichedMetadata = metadata
      ? JSON.stringify({
          ...JSON.parse(metadata),
          ...(isClassroom || isSpeech ? { role } : {}),
        })
      : isClassroom || isSpeech
        ? JSON.stringify({ role })
        : '';

    const participantToken = await createParticipantToken(
      {
        identity: `${participantName}__${randomParticipantPostfix}`,
        name: participantName,
        metadata: enrichedMetadata,
      },
      roomName,
      isClassroom || isSpeech,
      userRole, // Use the verified role from database if authenticated
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: roomName,
      participantToken: participantToken,
      participantName: participantName,
    };
    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  isRoleBasedSession: boolean = false,
  role: string = 'student',
) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '5m';

  let grant: VideoGrant;

  if (isRoleBasedSession) {
    if (role === 'teacher') {
      // Teachers have full permissions
      grant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
        canUpdateOwnMetadata: true,
        // Teacher can manage room
        roomAdmin: true,
        roomRecord: true,
      };
    } else {
      // Students start without publish capability (will be granted by teacher)
      grant = {
        room: roomName,
        roomJoin: true,
        canPublish: false, // Cannot publish audio/video initially
        canPublishData: true, // Can still use chat
        canSubscribe: true,
        canUpdateOwnMetadata: true, // Allow students to set their language preference
      };
    }
  } else {
    // Regular meeting room - existing behavior
    grant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true, // Allow setting language preferences
    };
  }

  at.addGrant(grant);
  return at.toJwt();
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
