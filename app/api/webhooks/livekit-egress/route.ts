import { NextRequest, NextResponse } from 'next/server';
import { updateRecording, getRecordingByEgressId } from '@/lib/recording-utils';

const S3_ENDPOINT = process.env.S3_ENDPOINT!;
const S3_BUCKET = process.env.S3_BUCKET!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN; // Optional: Custom R2 public domain

/**
 * Construct public URL from S3 filename
 * Handles both full URLs from LiveKit and relative paths
 */
function constructS3Url(filename: string): string {
  // LiveKit sometimes returns full URLs - extract just the path
  if (filename.startsWith('https://') || filename.startsWith('http://')) {
    try {
      const url = new URL(filename);
      // Extract path: /livekit-recordings/8bao-fy2z/... → 8bao-fy2z/...
      const pathParts = url.pathname.split('/').filter((p) => p);
      const bucketIndex = pathParts.indexOf(S3_BUCKET);

      if (bucketIndex >= 0) {
        // Found bucket name in path - take everything after it
        filename = pathParts.slice(bucketIndex + 1).join('/');
      } else {
        // No bucket in path - use entire path
        filename = pathParts.join('/');
      }

      console.log(`[URL Extract] Extracted path from full URL: ${filename}`);
    } catch (e) {
      console.error('[URL Parse Error]', e);
    }
  }

  // Use public domain if configured (RECOMMENDED)
  if (R2_PUBLIC_DOMAIN) {
    return `${R2_PUBLIC_DOMAIN}/${filename}`;
  }

  // Fallback: Use private endpoint (won't work for playback without public access)
  if (S3_ENDPOINT && S3_ENDPOINT.includes('r2.cloudflarestorage.com')) {
    console.warn('[R2 URL] No public domain configured - playback may not work');
    return `${S3_ENDPOINT}/${S3_BUCKET}/${filename}`;
  }

  // AWS S3 format (public bucket)
  if (S3_BUCKET) {
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${filename}`;
  }

  // Fallback
  return filename;
}

/**
 * LiveKit Egress Webhook Handler
 * Handles egress events (started, updated, ended, failed)
 * Updates recording status and URLs in database
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();

    // Enhanced logging - log full payload for debugging
    console.log('========================================');
    console.log('[LiveKit Webhook] FULL PAYLOAD:');
    console.log(JSON.stringify(event, null, 2));
    console.log('========================================');

    const { egressInfo, event: eventType } = event;

    // Ignore non-egress events (participant_joined, room_started, etc.)
    if (!egressInfo) {
      console.log(`[LiveKit Webhook] Ignoring non-egress event: ${eventType}`);
      return NextResponse.json({ message: 'Non-egress event ignored' }, { status: 200 });
    }

    const {
      egressId,
      status,
      roomName,
      startedAt,
      endedAt,
      duration,
      fileResults,
      segmentResults,
    } = egressInfo;

    // Find recording by egress ID
    const recording = await getRecordingByEgressId(egressId);
    if (!recording) {
      console.warn(`[LiveKit Webhook] Recording not found for egress ID: ${egressId}`);
      return NextResponse.json({ message: 'Recording not found' }, { status: 404 });
    }

    console.log(`[LiveKit Webhook] Processing status: ${status} for recording: ${recording.id}`);

    // Handle different event types
    switch (status) {
      case 'EGRESS_STARTING':
      case 1:
        console.log(`[LiveKit Webhook] Egress starting for recording: ${recording.id}`);
        await updateRecording(recording.id, { status: 'ACTIVE' });
        break;

      case 'EGRESS_ACTIVE':
      case 2:
        // Optional: update with intermediate info
        console.log(`[LiveKit Webhook] Egress active for recording: ${recording.id}`);
        break;

      case 'EGRESS_ENDING':
      case 3:
      case 'EGRESS_COMPLETE':
      case 4:
        console.log(`[LiveKit Webhook] Egress completed for recording: ${recording.id}`);

        // Extract file URLs from results
        let hlsUrl = null;
        let mp4Url = null;
        let totalSize = 0;

        // Check segment results (HLS)
        if (segmentResults && segmentResults.length > 0) {
          console.log(`[LiveKit Webhook] Processing ${segmentResults.length} segment results`);
          segmentResults.forEach((result: any) => {
            if (result.playlistLocation) {
              hlsUrl = constructS3Url(result.playlistLocation);
              console.log(`[LiveKit Webhook] HLS playlist URL: ${hlsUrl}`);
            }
            totalSize += Number(result.size) || 0;
          });
        }

        // Check file results (MP4)
        if (fileResults && fileResults.length > 0) {
          console.log(`[LiveKit Webhook] Processing ${fileResults.length} file results`);
          fileResults.forEach((result: any) => {
            if (result.filename?.endsWith('.mp4')) {
              mp4Url = constructS3Url(result.filename);
              console.log(`[LiveKit Webhook] MP4 URL: ${mp4Url}`);
            }
            totalSize += Number(result.size) || 0;
          });
        }

        // Convert nanoseconds to seconds
        let durationSeconds = duration ? Math.floor(Number(duration) / 1000000000) : null;

        const endedAtDate = endedAt
          ? new Date(Number(endedAt) / 1000000).toISOString()
          : new Date().toISOString();

        // Fallback: Calculate duration from timestamps if webhook doesn't provide it
        if (!durationSeconds && recording.started_at) {
          const startTime = new Date(recording.started_at).getTime();
          const endTime = new Date(endedAtDate).getTime();
          durationSeconds = Math.floor((endTime - startTime) / 1000);
          console.log(`[LiveKit Webhook] Duration calculated from timestamps: ${durationSeconds}s`);
        }

        console.log(
          `[LiveKit Webhook] Updating recording with duration: ${durationSeconds}s, size: ${totalSize} bytes`,
        );

        await updateRecording(recording.id, {
          status: 'COMPLETED',
          ended_at: endedAtDate,
          hls_playlist_url: hlsUrl ?? undefined,
          mp4_url: mp4Url ?? undefined,
          duration_seconds: durationSeconds ?? undefined,
          size_bytes: totalSize ?? undefined,
        });
        break;

      case 'EGRESS_FAILED':
      case 5:
        console.error(`[LiveKit Webhook] Egress failed for recording: ${recording.id}`);
        await updateRecording(recording.id, {
          status: 'FAILED',
          ended_at: new Date().toISOString(),
        });
        break;

      default:
        console.warn(`[LiveKit Webhook] Unknown status: ${status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LiveKit Webhook] Handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
