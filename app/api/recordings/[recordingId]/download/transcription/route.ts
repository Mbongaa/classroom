import { NextRequest, NextResponse } from 'next/server';
import { getRecording, getRecordingTranscriptions } from '@/lib/recording-utils';
import {
  formatToSRT,
  formatToVTT,
  formatToTXT,
  generateFilename,
  getMimeType,
  FormatType,
} from '@/lib/download-formatters';

/**
 * GET /api/recordings/[recordingId]/download/transcription
 * Download transcription in requested format
 * Query params:
 *   - format: srt|vtt|txt (default: srt)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  try {
    const { recordingId } = await params;
    const format = (request.nextUrl.searchParams.get('format') || 'srt') as FormatType;

    // Validate format
    if (!['srt', 'vtt', 'txt'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use srt, vtt, or txt.' }, { status: 400 });
    }

    // Get recording details
    const recording = await getRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Get transcriptions
    const transcriptions = await getRecordingTranscriptions(recordingId);
    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions available for this recording' },
        { status: 404 },
      );
    }

    // Determine original language from first transcription
    const language = transcriptions[0]?.language || 'unknown';

    // Format transcriptions
    let content: string;
    switch (format) {
      case 'srt':
        content = formatToSRT(transcriptions);
        break;
      case 'vtt':
        content = formatToVTT(transcriptions);
        break;
      case 'txt':
        content = formatToTXT(transcriptions);
        break;
      default:
        content = formatToSRT(transcriptions);
    }

    if (!content) {
      return NextResponse.json({ error: 'Failed to format transcriptions' }, { status: 500 });
    }

    // Generate filename
    const filename = generateFilename(recording.room_name, 'transcription', language, format);

    // Return file with proper headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Download Transcription] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download transcription',
      },
      { status: 500 },
    );
  }
}
