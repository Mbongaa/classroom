import { NextRequest, NextResponse } from 'next/server';
import { saveTranscription } from '@/lib/recording-utils';

/**
 * POST /api/transcriptions
 * Save a transcription entry (original speaker language) during live session
 * Called by translation panels when original language transcription arrives
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, text, language, participantIdentity, participantName, timestampMs } = body;

    // Validate required fields
    if (!recordingId || !text || !language || !participantIdentity || !participantName || timestampMs === undefined) {
      console.error('[Transcription API] Missing required fields:', {
        hasRecordingId: !!recordingId,
        hasText: !!text,
        hasLanguage: !!language,
        hasParticipantIdentity: !!participantIdentity,
        hasParticipantName: !!participantName,
        hasTimestamp: timestampMs !== undefined,
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Save transcription to database
    const entry = await saveTranscription({
      recordingId,
      text,
      language,
      participantIdentity,
      participantName,
      timestampMs,
    });

    console.log('[Transcription API] Transcription saved successfully:', {
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
    console.error('[Transcription API] Failed to save transcription:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
