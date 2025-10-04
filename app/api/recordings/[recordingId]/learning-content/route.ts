import { NextRequest, NextResponse } from 'next/server';
import { getRecording, getRecordingTranscriptions } from '@/lib/recording-utils';
import {
  LearningContentGenerator,
  LearningContent,
} from '@/lib/gemini/learning-content-generator';

/**
 * POST /api/recordings/[recordingId]/learning-content
 *
 * Generate structured learning content from recording transcriptions.
 * Uses Gemini AI to transform raw transcripts into educational material.
 *
 * Request Body:
 *   - targetLanguage: string (ISO code: en, es, fr, de, ja, cmn, ar)
 *
 * Response:
 *   - LearningContent object with summary and thematic breakdown
 *
 * Error Responses:
 *   - 400: Missing or invalid parameters
 *   - 404: Recording not found or no transcriptions available
 *   - 500: Generation failed
 *   - 503: Gemini API not configured
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  try {
    const { recordingId } = await params;

    // Parse request body
    const body = await request.json();
    const { targetLanguage } = body;

    // Validate target language
    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required field: targetLanguage' },
        { status: 400 },
      );
    }

    const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'cmn', 'ar'];
    if (!validLanguages.includes(targetLanguage)) {
      return NextResponse.json(
        {
          error: `Invalid target language. Supported languages: ${validLanguages.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Check Gemini API configuration
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Learning Content API] GEMINI_API_KEY not configured');
      return NextResponse.json(
        {
          error:
            'Learning content service not configured. Please add GEMINI_API_KEY to environment variables.',
        },
        { status: 503 },
      );
    }

    console.log('[Learning Content API] Request received:', {
      recordingId,
      targetLanguage,
    });

    // Fetch recording details
    const recording = await getRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Fetch all transcriptions
    const transcriptions = await getRecordingTranscriptions(recordingId);
    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        {
          error:
            'No transcriptions available for this recording. Please ensure the session was recorded with transcription enabled.',
        },
        { status: 404 },
      );
    }

    // Sort transcriptions by timestamp to ensure chronological order
    const sortedTranscriptions = [...transcriptions].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );

    // Combine transcriptions into full transcript
    const fullTranscript = sortedTranscriptions
      .map((t) => {
        // Format: "Speaker: text"
        const speaker = t.participant_name || 'Speaker';
        return `${speaker}: ${t.text.trim()}`;
      })
      .join('\n\n');

    console.log('[Learning Content API] Transcript prepared:', {
      entryCount: sortedTranscriptions.length,
      totalLength: fullTranscript.length,
      originalLanguage: sortedTranscriptions[0]?.language || 'unknown',
    });

    // Check transcript size (prevent excessive API costs)
    const maxTokens = 32000; // Gemini Flash limit
    if (!LearningContentGenerator.isTranscriptSizeAcceptable(fullTranscript, maxTokens)) {
      const estimatedTokens = LearningContentGenerator.estimateTokenCount(fullTranscript);
      console.warn('[Learning Content API] Transcript too large:', {
        estimatedTokens,
        maxTokens,
      });

      return NextResponse.json(
        {
          error: `Transcript is too long (estimated ${estimatedTokens} tokens, max ${maxTokens}). Please contact support for assistance with long recordings.`,
        },
        { status: 400 },
      );
    }

    // Initialize learning content generator
    const generator = new LearningContentGenerator(process.env.GEMINI_API_KEY);

    // Generate learning content
    const startTime = Date.now();
    const learningContent: LearningContent = await generator.generate({
      transcript: fullTranscript,
      targetLanguage,
      roomName: recording.room_name,
      teacherName: recording.teacher_name || undefined,
    });
    const generationTime = Date.now() - startTime;

    console.log('[Learning Content API] ✅ Learning content generated successfully:', {
      recordingId,
      targetLanguage,
      generationTimeMs: generationTime,
      keyPoints: learningContent.summary.key_points.length,
      themes: learningContent.thematic_breakdown.length,
    });

    // Return successful response
    return NextResponse.json({
      success: true,
      data: learningContent,
      metadata: {
        recordingId,
        roomName: recording.room_name,
        teacherName: recording.teacher_name,
        targetLanguage,
        transcriptionCount: transcriptions.length,
        generationTimeMs: generationTime,
      },
    });
  } catch (error) {
    console.error('[Learning Content API] ❌ Generation failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate learning content',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
