import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatBilingualToSRT,
  formatBilingualToVTT,
  formatBilingualToTXT,
  pairTranslationsWithTranscriptions,
  generateFilename,
  getMimeType,
  FormatType,
} from '@/lib/download-formatters';

/**
 * GET /api/sessions/[sessionId]/download/translation
 * Download translation by session UUID — works for v2 (preferred) and legacy sessions.
 * Query params:
 *   - language: target language code (required)
 *   - format: srt|vtt|txt (default: srt)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const language = request.nextUrl.searchParams.get('language');
    const format = (request.nextUrl.searchParams.get('format') || 'srt') as FormatType;

    if (!language) {
      return NextResponse.json({ error: 'Language parameter is required' }, { status: 400 });
    }

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

    let translations: any[] | null = null;
    let transcriptions: any[] | null = null;
    let roomName = 'session';

    if (v2Session) {
      const [{ data: v2Tx }, { data: v2Trans }] = await Promise.all([
        supabase
          .from('v2_translation_entries')
          .select('*')
          .eq('session_id', sessionId)
          .eq('language', language)
          .order('timestamp_ms', { ascending: true }),
        supabase
          .from('v2_transcriptions')
          .select('*')
          .eq('session_id', sessionId)
          .order('timestamp_ms', { ascending: true }),
      ]);
      translations = v2Tx ?? null;
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
      const [{ data: legacyTx }, { data: legacyTrans }] = await Promise.all([
        supabase
          .from('translation_entries')
          .select('*')
          .eq('session_id', sessionId)
          .eq('language', language)
          .order('timestamp_ms', { ascending: true }),
        supabase
          .from('transcriptions')
          .select('*')
          .eq('session_id', sessionId)
          .order('timestamp_ms', { ascending: true }),
      ]);
      translations = legacyTx ?? null;
      transcriptions = legacyTrans ?? null;
      roomName = legacySession?.room_name || 'session';
    }

    if (!translations || translations.length === 0) {
      return NextResponse.json(
        { error: `No translations available in ${language} for this session` },
        { status: 404 },
      );
    }

    const bilingualEntries = pairTranslationsWithTranscriptions(translations, transcriptions || []);

    let content: string;
    switch (format) {
      case 'srt':
        content = formatBilingualToSRT(bilingualEntries);
        break;
      case 'vtt':
        content = formatBilingualToVTT(bilingualEntries);
        break;
      case 'txt':
        content = formatBilingualToTXT(bilingualEntries);
        break;
      default:
        content = formatBilingualToSRT(bilingualEntries);
    }

    if (!content) {
      return NextResponse.json({ error: 'Failed to format translations' }, { status: 500 });
    }

    const filename = generateFilename(roomName, 'translation', language, format);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Session Download Translation] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download translation' },
      { status: 500 },
    );
  }
}
