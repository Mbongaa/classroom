import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
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

    const { roomCode } = await params;

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    // Initialize RoomServiceClient
    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Delete the room
    await roomService.deleteRoom(roomCode);

    return NextResponse.json({
      success: true,
      message: `Room ${roomCode} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting room:', error);

    // Handle room not found error
    if (error.message && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete room', details: error.message },
      { status: 500 },
    );
  }
}
