import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { updateRecording } from '@/lib/recording-utils';

export async function GET(req: NextRequest) {
  // Require teacher authentication for recording operations
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    const recordingId = req.nextUrl.searchParams.get('recordingId');

    if (!roomName) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Get active egresses for this room
    const activeEgresses = (await egressClient.listEgress({ roomName })).filter(
      (info) => info.status < 2,
    );

    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }

    // Stop all active egresses
    await Promise.all(activeEgresses.map((info) => egressClient.stopEgress(info.egressId)));

    // Update database if recordingId provided
    if (recordingId) {
      await updateRecording(recordingId, {
        ended_at: new Date().toISOString(),
      });
    }

    console.log(
      `[Recording Stop] Stopped ${activeEgresses.length} egress(es) for room: ${roomName}`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Recording Stop] Failed:', error);
    return new NextResponse(error instanceof Error ? error.message : 'Unknown error', {
      status: 500,
    });
  }
}
