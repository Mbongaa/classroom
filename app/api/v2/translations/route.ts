import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/v2/translations
 * Save a translation entry to v2_translation_entries (FK to v2_sessions).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, text, language, participantName, timestampMs, segmentId, originalText } =
      body;

    if (!sessionId || !text || !language || !participantName || timestampMs === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, text, language, participantName, timestampMs' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // sessionId IS the v2_sessions UUID directly
    const insertRow: Record<string, unknown> = {
      session_id: sessionId,
      text,
      language,
      participant_name: participantName,
      timestamp_ms: timestampMs,
    };
    if (segmentId) insertRow.segment_id = segmentId;
    if (originalText) insertRow.original_text = originalText;

    const { data: entry, error: saveError } = await supabase
      .from('v2_translation_entries')
      .insert(insertRow)
      .select()
      .single();

    if (saveError) {
      // 23505 = unique_violation — duplicate segment, silently ignore
      if (saveError.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      console.error('[V2 Translation] Save error:', saveError);
      throw new Error(`Failed to save translation: ${saveError.message}`);
    }

    return NextResponse.json({
      success: true,
      entry: { id: entry.id, timestampMs: entry.timestamp_ms },
    });
  } catch (error) {
    console.error('[V2 Translation] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
