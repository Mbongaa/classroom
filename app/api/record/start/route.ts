import {
  EgressClient,
  EncodedFileOutput,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  S3Upload,
  EncodedFileType,
} from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { createRecording, generateSessionId } from '@/lib/recording-utils';
import { getClassroomByRoomCode, getClassroomById } from '@/lib/classroom-utils';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  // Require teacher authentication for recording operations
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    const roomCode = req.nextUrl.searchParams.get('roomName'); // User-facing room code
    const roomSid = req.nextUrl.searchParams.get('roomSid');
    const teacherName = req.nextUrl.searchParams.get('teacherName');

    if (!roomCode || !roomSid || !teacherName) {
      return new NextResponse('Missing required parameters: roomName, roomSid, teacherName', {
        status: 400,
      });
    }

    const { profile } = auth;

    // Detect if roomCode is a UUID (persistent classroom) or room_code (ad-hoc room)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomCode);

    // Try to find classroom (optional - for persistent rooms)
    let classroom = null;
    if (profile?.organization_id) {
      try {
        if (isUUID) {
          // Persistent classroom - roomCode is actually classroom.id (UUID)
          classroom = await getClassroomById(roomCode);
        } else {
          // Legacy or ad-hoc - try lookup by room_code
          classroom = await getClassroomByRoomCode(roomCode, profile.organization_id);
        }
      } catch (error) {
        console.log('[Recording] No classroom found, using ad-hoc room');
      }
    }

    // Use classroom.room_code for display (clean names), classroom.id for LiveKit
    const displayRoomCode = classroom?.room_code || roomCode;
    const livekitRoomName = classroom?.id || roomCode;

    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      LIVEKIT_URL,
      S3_ACCESS_KEY,
      S3_SECRET_KEY,
      S3_BUCKET,
      S3_ENDPOINT,
      S3_REGION,
    } = process.env;

    // Generate unique session ID using clean display code (MATH101 instead of UUID)
    const sessionId = generateSessionId(displayRoomCode);
    const s3Prefix = `${displayRoomCode}/${sessionId}/`;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Check for existing active recordings
    const existingEgresses = await egressClient.listEgress({ roomName: livekitRoomName });
    if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
      return new NextResponse('Recording already in progress', { status: 409 });
    }

    // HLS output (primary - for streaming playback)
    const hlsOutput = new SegmentedFileOutput({
      filenamePrefix: s3Prefix,
      playlistName: 'index.m3u8',
      segmentDuration: 6, // 6-second segments
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: S3_ACCESS_KEY!,
          secret: S3_SECRET_KEY!,
          bucket: S3_BUCKET!,
          region: S3_REGION!,
          endpoint: S3_ENDPOINT,
          forcePathStyle: true, // Required for Cloudflare R2
        }),
      },
    });

    // Optional: MP4 output for downloads
    const mp4Output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `${s3Prefix}session.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: S3_ACCESS_KEY!,
          secret: S3_SECRET_KEY!,
          bucket: S3_BUCKET!,
          region: S3_REGION!,
          endpoint: S3_ENDPOINT,
          forcePathStyle: true,
        }),
      },
    });

    // Start Room Composite Egress with HLS + MP4 output
    // Use LiveKit room name (UUID) for egress
    const egressInfo = await egressClient.startRoomCompositeEgress(
      livekitRoomName, // Use UUID
      {
        segments: hlsOutput,
        file: mp4Output, // Optional MP4
      },
      {
        layout: 'speaker', // Teacher-focused layout
      },
    );

    // Check if a session already exists for this room
    const supabase = createAdminClient();
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    let sessionUuid = existingSession?.id;

    // If no session exists, create one
    if (!sessionUuid) {
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          room_sid: roomSid,
          room_name: displayRoomCode,
          session_id: sessionId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (sessionError) {
        console.error('[Recording] Failed to create session:', sessionError);
      } else {
        sessionUuid = newSession.id;
      }
    }

    // Create database record with optional classroom and session link
    const recording = await createRecording({
      roomSid,
      roomName: displayRoomCode, // Use clean room_code (MATH101) for display, not UUID
      sessionId,
      egressId: egressInfo.egressId,
      teacherName,
      classroomId: classroom?.id ?? undefined, // Link to classroom UUID if exists
      createdBy: auth.user?.id,
      sessionUuid, // Link to session if exists
    });

    return NextResponse.json({
      success: true,
      recording: {
        id: recording.id,
        sessionId: recording.session_id,
        egressId: recording.livekit_egress_id,
        status: recording.status,
      },
    });
  } catch (error) {
    console.error('Failed to start recording:', error);
    return new NextResponse(error instanceof Error ? error.message : 'Unknown error', {
      status: 500,
    });
  }
}
