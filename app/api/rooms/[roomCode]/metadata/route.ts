import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing LiveKit credentials' },
        { status: 500 }
      );
    }

    const { roomCode } = params;

    // Initialize RoomServiceClient
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    try {
      // List all rooms and find the matching one
      const rooms = await roomService.listRooms([roomCode]);

      if (rooms.length === 0) {
        // Room doesn't exist or has no metadata
        return NextResponse.json({ metadata: null });
      }

      const room = rooms[0];
      let metadata = null;

      if (room.metadata) {
        try {
          metadata = JSON.parse(room.metadata);
        } catch (error) {
          console.error('Failed to parse room metadata:', error);
        }
      }

      return NextResponse.json({
        metadata,
        roomExists: true,
      });
    } catch (error: any) {
      // Room not found
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        return NextResponse.json({ metadata: null, roomExists: false });
      }
      throw error; // Re-throw other errors
    }
  } catch (error: any) {
    console.error('Error fetching room metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room metadata', details: error.message },
      { status: 500 }
    );
  }
}