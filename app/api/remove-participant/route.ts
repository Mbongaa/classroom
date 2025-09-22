import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  throw new Error('LiveKit environment variables are not set');
}

interface RemoveParticipantRequest {
  roomName: string;
  participantIdentity: string;
  teacherToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RemoveParticipantRequest = await request.json();
    const { roomName, participantIdentity, teacherToken } = body;

    // Validate required fields
    if (!roomName || !participantIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: In production, validate teacher authorization with proper JWT verification
    // For now, we'll skip validation for simplicity

    // Create RoomServiceClient
    const roomService = new RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    // Remove the participant from the room
    try {
      await roomService.removeParticipant(roomName, participantIdentity);
    } catch (error) {
      console.error('Failed to remove participant:', error);
      return NextResponse.json(
        { error: 'Failed to remove participant from room' },
        { status: 500 }
      );
    }

    // Return success
    return NextResponse.json({
      success: true,
      participantIdentity,
      message: 'Participant removed from classroom'
    });

  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}