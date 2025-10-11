import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClassroomByRoomCode } from '@/lib/classroom-utils';

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

    // CLASSROOM LOOKUP AND LIVEKIT BRIDGE
    // This is the critical mapping: user-facing room_code → LiveKit UUID
    let userRole = role; // Default to query param role
    let livekitRoomName = roomName; // Default to user-facing room name
    let classroom = null;

    // If this is a classroom/speech session, look up in Supabase
    if ((isClassroom || isSpeech) && roomName) {
      // Get user's organization context if authenticated
      let organizationId: string | undefined;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          organizationId = profile.organization_id;

          // Use actual role from database for authenticated users
          if (profile.role === 'teacher' || profile.role === 'admin') {
            userRole = 'teacher';
          } else {
            userRole = 'student';
          }
        }
      }

      // Lookup classroom by room_code (user-facing identifier)
      classroom = await getClassroomByRoomCode(roomName, organizationId);

      if (classroom) {
        // Use classroom.id (UUID) as LiveKit room name for uniqueness
        livekitRoomName = classroom.id;

        // Ensure LiveKit room exists (LAZY CREATION)
        if (API_KEY && API_SECRET && LIVEKIT_URL) {
          try {
            const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

            // Check if room exists
            const existingRooms = await roomService.listRooms([livekitRoomName]);

            if (existingRooms.length === 0) {
              // Create LiveKit room on-demand
              console.log(
                `Creating LiveKit room for classroom ${classroom.room_code} (${classroom.id})`,
              );
              await roomService.createRoom({
                name: livekitRoomName, // Use UUID
                emptyTimeout: 604800, // 7 days
                metadata: '', // Supabase has all metadata
              });
            }
          } catch (error) {
            console.error('Error ensuring LiveKit room exists:', error);
            // Continue anyway - token generation might still work
          }
        }

        // Track participation for authenticated users
        if (user) {
          try {
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
          } catch (error) {
            console.error('Error tracking participation:', error);
            // Don't fail the request if tracking fails
          }
        }
      } else {
        // Classroom not found in Supabase
        console.warn(`Classroom not found: ${roomName}`);
        // Fall back to using room_code directly (for non-classroom rooms or legacy)
        livekitRoomName = roomName;
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
    if (!livekitRoomName) {
      return new NextResponse('Invalid room configuration', { status: 500 });
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
      livekitRoomName, // Use LiveKit room name (UUID for classrooms)
      isClassroom || isSpeech,
      userRole, // Use the verified role from database if authenticated
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: livekitRoomName, // LiveKit room name (UUID for classrooms)
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

async function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  isRoleBasedSession: boolean = false,
  role: string = 'student',
) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);

  // CRITICAL FIX: Set longer TTL for better user experience and production stability
  at.ttl = '4h'; // 4 hours - Prevents token expiration during normal usage

  // CLOCK SKEW MITIGATION: Add a small delay before returning the token
  // This ensures the token's internal nbf (not before) timestamp is slightly in the past
  // when it reaches the client, preventing "Token is not valid yet" errors
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

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
