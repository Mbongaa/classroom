import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/v2/transcriptions
 * Save a transcription entry to v2_transcriptions (FK to v2_sessions).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, text, language, participantIdentity, participantName, timestampMs } = body;

    if (
      !sessionId ||
      !text ||
      !language ||
      !participantIdentity ||
      !participantName ||
      timestampMs === undefined
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // sessionId IS the v2_sessions UUID directly (no string→UUID lookup needed)
    const { data: entry, error: saveError } = await supabase
      .from('v2_transcriptions')
      .insert({
        session_id: sessionId,
        text,
        language,
        participant_identity: participantIdentity,
        participant_name: participantName,
        timestamp_ms: timestampMs,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[V2 Transcription] Save error:', saveError);
      throw new Error(`Failed to save transcription: ${saveError.message}`);
    }

    return NextResponse.json({
      success: true,
      entry: { id: entry.id, timestampMs: entry.timestamp_ms },
    });
  } catch (error) {
    console.error('[V2 Transcription] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
