import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LearningContentGenerator, LearningContent } from '@/lib/gemini/learning-content-generator';

/**
 * POST /api/sessions/[sessionId]/learning-content
 * Generate learning content directly from session transcriptions — no recording required.
 *
 * Request Body:
 *   - targetLanguage: string (ISO code)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { targetLanguage } = body;

    if (!targetLanguage) {
      return NextResponse.json({ error: 'Missing required field: targetLanguage' }, { status: 400 });
    }

    const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh-CN', 'ar'];
    if (!validLanguages.includes(targetLanguage)) {
      return NextResponse.json(
        { error: `Invalid target language. Supported languages: ${validLanguages.join(', ')}` },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Learning content service not configured. Please add GEMINI_API_KEY to environment variables.' },
        { status: 503 },
      );
    }

    const supabase = createAdminClient();

    // Get session info
    const { data: session } = await supabase
      .from('sessions')
      .select('room_name')
      .eq('id', sessionId)
      .single();

    // Get transcriptions directly by session_id
    const { data: transcriptions, error } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: true });

    if (error || !transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions available for this session.' },
        { status: 404 },
      );
    }

    const roomName = session?.room_name || 'session';

    // Combine transcriptions into full transcript
    const fullTranscript = transcriptions
      .map((t) => {
        const speaker = t.participant_name || 'Speaker';
        return `${speaker}: ${t.text.trim()}`;
      })
      .join('\n\n');

    // Check transcript size
    const maxTokens = 32000;
    if (!LearningContentGenerator.isTranscriptSizeAcceptable(fullTranscript, maxTokens)) {
      const estimatedTokens = LearningContentGenerator.estimateTokenCount(fullTranscript);
      return NextResponse.json(
        { error: `Transcript is too long (estimated ${estimatedTokens} tokens, max ${maxTokens}).` },
        { status: 400 },
      );
    }

    const generator = new LearningContentGenerator(process.env.GEMINI_API_KEY);

    const startTime = Date.now();
    const learningContent: LearningContent = await generator.generate({
      transcript: fullTranscript,
      targetLanguage,
      roomName,
    });
    const generationTime = Date.now() - startTime;

    // Prepare transcript segments for client
    const transcriptSegments = transcriptions.map((t) => ({
      participant_name: t.participant_name || 'Speaker',
      text: t.text.trim(),
      timestamp_ms: t.timestamp_ms,
      language: t.language,
    }));

    return NextResponse.json({
      success: true,
      data: learningContent,
      metadata: {
        sessionId,
        roomName,
        teacherName: null,
        targetLanguage,
        transcriptionCount: transcriptions.length,
        generationTimeMs: generationTime,
      },
      recording: {
        hlsPlaylistUrl: null,
        mp4Url: null,
        durationSeconds: null,
        status: 'SESSION_ONLY',
        startedAt: null,
      },
      transcript: {
        segments: transcriptSegments,
        originalLanguage: transcriptions[0]?.language || 'unknown',
      },
    });
  } catch (error) {
    console.error('[Session Learning Content] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate learning content' },
      { status: 500 },
    );
  }
}
