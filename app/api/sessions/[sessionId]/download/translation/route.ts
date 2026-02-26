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
 * Download translation by session UUID — no recording required.
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

    // Get session for room_name (used in filename)
    const { data: session } = await supabase
      .from('sessions')
      .select('room_name')
      .eq('id', sessionId)
      .single();

    // Get translations directly by session_id
    const { data: translations, error: translationError } = await supabase
      .from('translation_entries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('language', language)
      .order('timestamp_ms', { ascending: true });

    if (translationError || !translations || translations.length === 0) {
      return NextResponse.json(
        { error: `No translations available in ${language} for this session` },
        { status: 404 },
      );
    }

    // Get original transcriptions to pair (bilingual format)
    const { data: transcriptions } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: true });

    const roomName = session?.room_name || 'session';
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
