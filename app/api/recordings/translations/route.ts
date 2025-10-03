import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/recordings/translations
 * Save a translation entry during live session
 * Now uses session_id instead of recording_id for proper separation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, text, language, participantName, timestampMs } = body;

    // Validate required fields
    if (!sessionId || !text || !language || !participantName || timestampMs === undefined) {
      console.error('[Translation API] Missing required fields:', {
        hasSessionId: !!sessionId,
        hasText: !!text,
        hasLanguage: !!language,
        hasParticipantName: !!participantName,
        hasTimestamp: timestampMs !== undefined,
      });
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, text, language, participantName, timestampMs' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Get session UUID from session_id string
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[Translation API] Session not found:', sessionId, sessionError);
      return NextResponse.json(
        { error: `Session not found: ${sessionId}` },
        { status: 404 },
      );
    }

    // Save translation with session reference (no recording needed)
    const { data: entry, error: saveError } = await supabase
      .from('translation_entries')
      .insert({
        session_id: session.id,
        recording_id: null, // No recording needed for translations
        text,
        language,
        participant_name: participantName,
        timestamp_ms: timestampMs,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Translation API] Failed to save translation:', saveError);
      throw new Error(`Failed to save translation: ${saveError.message}`);
    }

    console.log('[Translation API] Translation saved successfully:', {
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
