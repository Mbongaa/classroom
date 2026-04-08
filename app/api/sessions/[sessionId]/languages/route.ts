import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/sessions/[sessionId]/languages
 * Returns available transcription and translation languages for a session.
 *
 * Works with BOTH v2_sessions UUIDs (preferred, source of truth) and legacy
 * sessions UUIDs (for historical records). Tries v2 tables first; if empty,
 * falls back to the legacy tables.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const supabase = createAdminClient();

    // Try v2 first
    const [{ data: v2Trans }, { data: v2Tx }] = await Promise.all([
      supabase.from('v2_transcriptions').select('language').eq('session_id', sessionId),
      supabase.from('v2_translation_entries').select('language').eq('session_id', sessionId),
    ]);

    let transcriptions = v2Trans ?? [];
    let translations = v2Tx ?? [];

    // Fall back to legacy if v2 is empty
    if (transcriptions.length === 0 && translations.length === 0) {
      const [{ data: legacyTrans }, { data: legacyTx }] = await Promise.all([
        supabase.from('transcriptions').select('language').eq('session_id', sessionId),
        supabase.from('translation_entries').select('language').eq('session_id', sessionId),
      ]);
      transcriptions = legacyTrans ?? [];
      translations = legacyTx ?? [];
    }

    return NextResponse.json({
      transcriptionLanguages: [...new Set(transcriptions.map((t) => t.language))],
      translationLanguages: [...new Set(translations.map((t) => t.language))],
    });
  } catch (error) {
    console.error('[Session Languages API] Error:', error);
    return NextResponse.json(
      { transcriptionLanguages: [], translationLanguages: [] },
    );
  }
}
