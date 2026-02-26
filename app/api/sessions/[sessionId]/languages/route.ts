import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/sessions/[sessionId]/languages
 * Returns available transcription and translation languages for a session.
 * Works directly with session UUID — no recording required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const supabase = createAdminClient();

    // Query distinct transcription languages
    const { data: transcriptions } = await supabase
      .from('transcriptions')
      .select('language')
      .eq('session_id', sessionId);

    // Query distinct translation languages
    const { data: translations } = await supabase
      .from('translation_entries')
      .select('language')
      .eq('session_id', sessionId);

    const transcriptionLanguages = [
      ...new Set((transcriptions || []).map((t) => t.language)),
    ];
    const translationLanguages = [
      ...new Set((translations || []).map((t) => t.language)),
    ];

    return NextResponse.json({
      transcriptionLanguages,
      translationLanguages,
    });
  } catch (error) {
    console.error('[Session Languages API] Error:', error);
    return NextResponse.json(
      { transcriptionLanguages: [], translationLanguages: [] },
    );
  }
}
