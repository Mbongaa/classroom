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
 * Download transcription by session UUID — works for v2 (preferred) and legacy sessions.
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

    // Try v2 first (source of truth)
    const { data: v2Session } = await supabase
      .from('v2_sessions')
      .select('livekit_room_name, classroom_id, classrooms:classroom_id(room_code)')
      .eq('id', sessionId)
      .maybeSingle();

    let transcriptions: any[] | null = null;
    let roomName = 'session';

    if (v2Session) {
      const { data: v2Trans } = await supabase
        .from('v2_transcriptions')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_ms', { ascending: true });
      transcriptions = v2Trans ?? null;
      roomName =
        (v2Session as any).classrooms?.room_code ||
        v2Session.livekit_room_name ||
        'session';
    } else {
      // Legacy fallback
      const { data: legacySession } = await supabase
        .from('sessions')
        .select('room_name')
        .eq('id', sessionId)
        .maybeSingle();
      const { data: legacyTrans } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_ms', { ascending: true });
      transcriptions = legacyTrans ?? null;
      roomName = legacySession?.room_name || 'session';
    }

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions available for this session' },
        { status: 404 },
      );
    }

    const language = transcriptions[0]?.language || 'unknown';

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
