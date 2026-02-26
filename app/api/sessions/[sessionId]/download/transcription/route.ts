import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatToSRT,
  formatToVTT,
  formatToTXT,
  generateFilename,
  getMimeType,
  FormatType,
} from '@/lib/download-formatters';

/**
 * GET /api/sessions/[sessionId]/download/transcription
 * Download transcription by session UUID — no recording required.
 * Query params:
 *   - format: srt|vtt|txt (default: srt)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const format = (request.nextUrl.searchParams.get('format') || 'srt') as FormatType;

    if (!['srt', 'vtt', 'txt'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use srt, vtt, or txt.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get session for room_name (used in filename)
    const { data: session } = await supabase
      .from('sessions')
      .select('room_name')
      .eq('id', sessionId)
      .single();

    // Get transcriptions directly by session_id
    const { data: transcriptions, error } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: true });

    if (error || !transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions available for this session' },
        { status: 404 },
      );
    }

    const language = transcriptions[0]?.language || 'unknown';
    const roomName = session?.room_name || 'session';

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

    const filename = generateFilename(roomName, 'transcription', language, format);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Session Download Transcription] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download transcription' },
      { status: 500 },
    );
  }
}
