import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

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

    // NEW: Check if this is a classroom and what role
    const isClassroom = request.nextUrl.searchParams.get('classroom') === 'true';
    const role = request.nextUrl.searchParams.get('role') ?? 'student'; // 'teacher' or 'student'
    const pin = request.nextUrl.searchParams.get('pin') ?? ''; // Optional PIN for classroom

    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
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

    // Add role and PIN to metadata for client-side use
    const enrichedMetadata = metadata
      ? JSON.stringify({
          ...JSON.parse(metadata),
          ...(isClassroom ? { role, ...(pin && role === 'teacher' ? { classroomPin: pin } : {}) } : {}),
        })
      : isClassroom
        ? JSON.stringify({ role, ...(pin && role === 'teacher' ? { classroomPin: pin } : {}) })
        : '';

    const participantToken = await createParticipantToken(
      {
        identity: `${participantName}__${randomParticipantPostfix}`,
        name: participantName,
        metadata: enrichedMetadata,
      },
      roomName,
      isClassroom,
      role,
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
  isClassroom: boolean = false,
  role: string = 'student',
) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '5m';

  let grant: VideoGrant;

  if (isClassroom) {
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
