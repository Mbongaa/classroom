import { NextRequest, NextResponse } from 'next/server';
import { getRecording, getRecordingTranslations } from '@/lib/recording-utils';
import {
  formatToSRT,
  formatToVTT,
  formatToTXT,
  generateFilename,
  getMimeType,
  FormatType,
} from '@/lib/download-formatters';

/**
 * GET /api/recordings/[recordingId]/download/translation
 * Download translation in requested language and format
 * Query params:
 *   - language: any language code saved in translations (required)
 *   - format: srt|vtt|txt (default: srt)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  try {
    const { recordingId } = await params;
    const language = request.nextUrl.searchParams.get('language');
    const format = (request.nextUrl.searchParams.get('format') || 'srt') as FormatType;

    // Validate language parameter is present (no whitelist — any saved language is valid)
    if (!language) {
      return NextResponse.json(
        { error: 'Language parameter is required' },
        { status: 400 },
      );
    }

    // Validate format
    if (!['srt', 'vtt', 'txt'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use srt, vtt, or txt.' }, { status: 400 });
    }

    // Get recording details
    const recording = await getRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Get translations for specified language
    const translations = await getRecordingTranslations(recordingId, language);
    if (!translations || translations.length === 0) {
      return NextResponse.json(
        { error: `No translations available in ${language} for this recording` },
        { status: 404 },
      );
    }

    // Format translations
    let content: string;
    switch (format) {
      case 'srt':
        content = formatToSRT(translations);
        break;
      case 'vtt':
        content = formatToVTT(translations);
        break;
      case 'txt':
        content = formatToTXT(translations);
        break;
      default:
        content = formatToSRT(translations);
    }

    if (!content) {
      return NextResponse.json({ error: 'Failed to format translations' }, { status: 500 });
    }

    // Generate filename
    const filename = generateFilename(recording.room_name, 'translation', language, format);

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
    console.error('[Download Translation] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download translation',
      },
      { status: 500 },
    );
  }
}
