import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { updateRecording } from '@/lib/recording-utils';
import { getClassroomByRoomCode, getClassroomById } from '@/lib/classroom-utils';

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

    const { profile } = auth;

    // Detect if roomName is a UUID (persistent classroom) or room_code (ad-hoc room)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomName);

    // Try to find classroom (optional - for persistent rooms)
    let classroom = null;
    if (profile?.organization_id) {
      try {
        if (isUUID) {
          // Persistent classroom - roomName is actually classroom.id (UUID)
          classroom = await getClassroomById(roomName);
        } else {
          // Legacy or ad-hoc - try lookup by room_code
          classroom = await getClassroomByRoomCode(roomName, profile.organization_id);
        }
      } catch (error) {
        console.log('[Recording Stop] No classroom found, using ad-hoc room');
      }
    }

    // Environment variables
    const API_KEY = process.env.LIVEKIT_API_KEY;
    const API_SECRET = process.env.LIVEKIT_API_SECRET;
    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const VERTEX_API_KEY = process.env.LIVEKIT_VERTEX_API_KEY;
    const VERTEX_API_SECRET = process.env.LIVEKIT_VERTEX_API_SECRET;
    const VERTEX_LIVEKIT_URL = process.env.LIVEKIT_VERTEX_URL;

    /**
     * Get LiveKit credentials based on language selection
     * Arabic ('ar') uses Bayaan credentials, all others use Vertex AI
     */
    function getCredentialsForLanguage(language: string) {
      if (language === 'ar') {
        // Arabic → Bayaan LiveKit
        return {
          apiKey: API_KEY!,
          apiSecret: API_SECRET!,
          url: LIVEKIT_URL!,
        };
      } else {
        // All others → Vertex AI LiveKit
        return {
          apiKey: VERTEX_API_KEY || API_KEY!,
          apiSecret: VERTEX_API_SECRET || API_SECRET!,
          url: VERTEX_LIVEKIT_URL || LIVEKIT_URL!,
        };
      }
    }

    // Determine language for credential routing
    let selectedLanguage = 'en'; // Default language for credential routing
    if (classroom && classroom.settings?.language) {
      // Persistent room: Use stored language
      selectedLanguage = classroom.settings.language;
      console.log(
        `[Recording Stop] Using classroom language: ${selectedLanguage} for room ${roomName}`,
      );
    } else {
      // Ad-hoc room or no language specified: Default to 'en' (Vertex AI)
      selectedLanguage = 'en';
      console.log(`[Recording Stop] Using default language: ${selectedLanguage} for room ${roomName}`);
    }

    // Get language-specific credentials
    const credentials = getCredentialsForLanguage(selectedLanguage);
    console.log(
      `[Recording Stop] Using ${selectedLanguage === 'ar' ? 'Bayaan' : 'Vertex AI'} credentials for room ${roomName}`,
    );

    // Use classroom.id (UUID) as LiveKit room name for persistent classrooms
    const livekitRoomName = classroom?.id || roomName;
    console.log(`[Recording Stop] LiveKit room name: ${livekitRoomName}`);

    const hostURL = new URL(credentials.url);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, credentials.apiKey, credentials.apiSecret);

    // Get active egresses for this room (use livekitRoomName - UUID for persistent rooms)
    const activeEgresses = (await egressClient.listEgress({ roomName: livekitRoomName })).filter(
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
