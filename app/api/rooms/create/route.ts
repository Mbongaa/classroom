import { RoomMetadata } from '@/lib/types';
import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Validation regex for room code: 4-20 alphanumeric + hyphens
const ROOM_CODE_REGEX = /^[a-zA-Z0-9-]{4,20}$/;

export async function POST(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing LiveKit credentials' },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { roomCode, roomType, teacherName, language, description } = body;

    // Validation
    if (!roomCode || typeof roomCode !== 'string') {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    if (!ROOM_CODE_REGEX.test(roomCode)) {
      return NextResponse.json(
        { error: 'Room code must be 4-20 alphanumeric characters or hyphens' },
        { status: 400 },
      );
    }

    if (!roomType || !['meeting', 'classroom', 'speech'].includes(roomType)) {
      return NextResponse.json(
        { error: 'Invalid room type. Must be meeting, classroom, or speech' },
        { status: 400 },
      );
    }

    // Teacher name is required for classroom and speech types
    if ((roomType === 'classroom' || roomType === 'speech') && !teacherName) {
      return NextResponse.json(
        { error: `Teacher name is required for ${roomType} rooms` },
        { status: 400 },
      );
    }

    // Create room metadata
    const metadata: RoomMetadata = {
      roomType,
      teacherName: teacherName || undefined,
      language: language || undefined,
      description: description || undefined,
      createdAt: Date.now(),
    };

    // Initialize RoomServiceClient
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    try {
      // Create room with 7-day empty timeout (604800 seconds)
      const room = await roomService.createRoom({
        name: roomCode,
        emptyTimeout: 604800, // 7 days in seconds
        metadata: JSON.stringify(metadata),
      });

      return NextResponse.json({
        success: true,
        room: {
          name: room.name,
          sid: room.sid,
          emptyTimeout: Number(room.emptyTimeout), // Convert BigInt to number
          metadata: metadata,
          creationTime: Number(room.creationTime), // Convert BigInt to number
        },
      });
    } catch (error: any) {
      // Handle duplicate room code error
      if (error.message && error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Room code already exists. Please choose a different code.' },
          { status: 409 },
        );
      }
      throw error; // Re-throw other errors
    }
  } catch (error: any) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error.message },
      { status: 500 },
    );
  }
}
