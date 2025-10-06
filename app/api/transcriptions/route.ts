import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/transcriptions
 * Save a transcription entry (original speaker language) during live session
 * Now uses session_id instead of recording_id for proper separation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, text, language, participantIdentity, participantName, timestampMs } = body;

    // Validate required fields
    if (
      !sessionId ||
      !text ||
      !language ||
      !participantIdentity ||
      !participantName ||
      timestampMs === undefined
    ) {
      console.error('[Transcription API] Missing required fields:', {
        hasSessionId: !!sessionId,
        hasText: !!text,
        hasLanguage: !!language,
        hasParticipantIdentity: !!participantIdentity,
        hasParticipantName: !!participantName,
        hasTimestamp: timestampMs !== undefined,
      });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get session UUID from session_id string
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[Transcription API] Session not found:', sessionId, sessionError);
      return NextResponse.json({ error: `Session not found: ${sessionId}` }, { status: 404 });
    }

    // Save transcription with session reference (no recording needed)
    const { data: entry, error: saveError } = await supabase
      .from('transcriptions')
      .insert({
        session_id: session.id,
        recording_id: null, // No recording needed for transcriptions
        text,
        language,
        participant_identity: participantIdentity,
        participant_name: participantName,
        timestamp_ms: timestampMs,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Transcription API] Failed to save transcription:', saveError);
      throw new Error(`Failed to save transcription: ${saveError.message}`);
    }

    console.log('[Transcription API] Transcription saved successfully:', {
      entryId: entry.id,
      sessionId,
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
