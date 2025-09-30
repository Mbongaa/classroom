import { PersistentRoom, RoomMetadata } from '@/lib/types';
import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function GET(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing LiveKit credentials' },
        { status: 500 }
      );
    }

    // Initialize RoomServiceClient
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // List all rooms
    const rooms = await roomService.listRooms();

    // Parse metadata and format response
    const formattedRooms: PersistentRoom[] = rooms.map((room) => {
      let metadata: RoomMetadata;

      try {
        // Parse metadata from JSON string
        metadata = room.metadata ? JSON.parse(room.metadata) : {
          roomType: 'meeting',
          createdAt: Number(room.creationTime), // Convert BigInt to number
        };
      } catch (error) {
        // Fallback if metadata parsing fails
        metadata = {
          roomType: 'meeting',
          createdAt: Number(room.creationTime), // Convert BigInt to number
        };
      }

      return {
        name: room.name,
        sid: room.sid,
        emptyTimeout: Number(room.emptyTimeout), // Convert BigInt to number
        metadata,
        creationTime: Number(room.creationTime), // Convert BigInt to number
        numParticipants: room.numParticipants, // This is typically a regular number
      };
    });

    return NextResponse.json({
      rooms: formattedRooms,
    });
  } catch (error: any) {
    console.error('Error listing rooms:', error);
    return NextResponse.json(
      { error: 'Failed to list rooms', details: error.message },
      { status: 500 }
    );
  }
}