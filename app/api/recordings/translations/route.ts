import { NextRequest, NextResponse } from 'next/server';
import { saveTranslationEntry } from '@/lib/recording-utils';

/**
 * POST /api/recordings/translations
 * Save a translation entry during live session
 * Called by translation panels when new translations arrive
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, text, language, participantName, timestampMs } = body;

    // Validate required fields
    if (!recordingId || !text || !language || !participantName || timestampMs === undefined) {
      console.error('[Translation API] Missing required fields:', {
        hasRecordingId: !!recordingId,
        hasText: !!text,
        hasLanguage: !!language,
        hasParticipantName: !!participantName,
        hasTimestamp: timestampMs !== undefined,
      });
      return NextResponse.json(
        { error: 'Missing required fields: recordingId, text, language, participantName, timestampMs' },
        { status: 400 },
      );
    }

    // Save translation entry to database
    const entry = await saveTranslationEntry({
      recordingId,
      text,
      language,
      participantName,
      timestampMs,
    });

    console.log('[Translation API] Translation saved successfully:', {
      entryId: entry.id,
      recordingId,
      language,
      timestampMs,
      textPreview: text.substring(0, 50) + '...',
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        timestampMs: entry.timestamp_ms,
      },
    });
  } catch (error) {
    console.error('[Translation API] Failed to save translation:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
