import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/recordings/[recordingId]/languages
 * Returns available transcription and translation languages for a recording's session
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  try {
    const { recordingId } = await params;
    const supabase = createAdminClient();

    // Get the recording's session_uuid
    const { data: recording, error: recordingError } = await supabase
      .from('session_recordings')
      .select('session_uuid')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording?.session_uuid) {
      return NextResponse.json(
        { transcriptionLanguages: [], translationLanguages: [] },
      );
    }

    const sessionUuid = recording.session_uuid;

    // Query distinct transcription languages
    const { data: transcriptions } = await supabase
      .from('transcriptions')
      .select('language')
      .eq('session_id', sessionUuid);

    // Query distinct translation languages
    const { data: translations } = await supabase
      .from('translation_entries')
      .select('language')
      .eq('session_id', sessionUuid);

    // Extract unique languages
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
    console.error('[Languages API] Error:', error);
    return NextResponse.json(
      { transcriptionLanguages: [], translationLanguages: [] },
    );
  }
}
