import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { requireTeacher } from '@/lib/api-auth';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  throw new Error('LiveKit environment variables are not set');
}

// Type assertions after validation - we know these are strings at this point
const API_KEY = LIVEKIT_API_KEY as string;
const API_SECRET = LIVEKIT_API_SECRET as string;
const URL = LIVEKIT_URL as string;

interface RemoveParticipantRequest {
  roomName: string;
  participantIdentity: string;
  teacherToken: string;
}

export async function POST(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    const body: RemoveParticipantRequest = await request.json();
    const { roomName, participantIdentity, teacherToken } = body;

    // Validate required fields
    if (!roomName || !participantIdentity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: In production, validate teacher authorization with proper JWT verification
    // For now, we'll skip validation for simplicity

    // Create RoomServiceClient
    const roomService = new RoomServiceClient(URL, API_KEY, API_SECRET);

    // Remove the participant from the room
    try {
      await roomService.removeParticipant(roomName, participantIdentity);
    } catch (error) {
      console.error('Failed to remove participant:', error);
      return NextResponse.json(
        { error: 'Failed to remove participant from room' },
        { status: 500 },
      );
    }

    // Return success
    return NextResponse.json({
      success: true,
      participantIdentity,
      message: 'Participant removed from classroom',
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json({ error: 'Failed to remove participant' }, { status: 500 });
  }
}
