import { NextRequest, NextResponse } from 'next/server';
import { getAllRecordings, getRoomRecordings } from '@/lib/recording-utils';

/**
 * GET /api/recordings
 * List all recordings or filter by room name
 * Query params:
 *   - roomName (optional): Filter by specific room
 */
export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName');

    let recordings;
    if (roomName) {
      recordings = await getRoomRecordings(roomName);
    } else {
      recordings = await getAllRecordings();
    }

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('[API Recordings] Failed to fetch recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
