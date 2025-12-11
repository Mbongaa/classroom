import { NextRequest, NextResponse } from 'next/server';
import { getRecordingTranscriptions } from '@/lib/recording-utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranscriptSegment } from '@/lib/types';

/**
 * POST /api/recordings/[recordingId]/translate-transcript
 *
 * Translate recording transcript segments to target language using Gemini AI.
 * Uses batch translation for efficiency (single API call for all segments).
 *
 * Request Body:
 *   - targetLanguage: string (ISO code: en, es, fr, de, ja, zh-CN, ar)
 *
 * Response:
 *   - translatedSegments: TranscriptSegment[] (translated text, preserved structure)
 *
 * Error Responses:
 *   - 400: Missing or invalid parameters
 *   - 404: Recording not found or no transcriptions available
 *   - 500: Translation failed
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

    const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh-CN', 'ar', 'nl'];
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
      console.error('[Translate Transcript API] GEMINI_API_KEY not configured');
      return NextResponse.json(
        {
          error:
            'Translation service not configured. Please add GEMINI_API_KEY to environment variables.',
        },
        { status: 503 },
      );
    }

    console.log('[Translate Transcript API] Request received:', {
      recordingId,
      targetLanguage,
    });

    // Fetch all transcriptions
    const transcriptions = await getRecordingTranscriptions(recordingId);
    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json(
        {
          error: 'No transcriptions available for this recording.',
        },
        { status: 404 },
      );
    }

    // Sort transcriptions by timestamp
    const sortedTranscriptions = [...transcriptions].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );

    // Prepare segments for translation
    const segments: TranscriptSegment[] = sortedTranscriptions.map((t) => ({
      participant_name: t.participant_name || 'Speaker',
      text: t.text.trim(),
      timestamp_ms: t.timestamp_ms,
      language: t.language,
    }));

    const originalLanguage = segments[0]?.language || 'unknown';

    console.log('[Translate Transcript API] Preparing translation:', {
      segmentCount: segments.length,
      originalLanguage,
      targetLanguage,
    });

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build translation prompt
    const prompt = buildTranslationPrompt(segments, originalLanguage, targetLanguage);

    // Call Gemini for batch translation
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const translationTime = Date.now() - startTime;

    // Parse and validate response
    const translatedSegments = parseTranslationResponse(response, segments);

    console.log('[Translate Transcript API] ✅ Translation successful:', {
      recordingId,
      segmentCount: translatedSegments.length,
      translationTimeMs: translationTime,
    });

    // Return successful response
    return NextResponse.json({
      success: true,
      translatedSegments,
      targetLanguage,
      originalLanguage,
      translationTimeMs: translationTime,
    });
  } catch (error) {
    console.error('[Translate Transcript API] ❌ Translation failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to translate transcript',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Build comprehensive Gemini prompt for batch transcript translation
 */
function buildTranslationPrompt(
  segments: TranscriptSegment[],
  originalLanguage: string,
  targetLanguage: string,
): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    ja: 'Japanese (日本語)',
    'zh-CN': 'Chinese (中文)',
    ar: 'Arabic (العربية)',
    nl: 'Dutch (Nederlands)',
  };

  const originalLanguageName = languageNames[originalLanguage] || originalLanguage;
  const targetLanguageName = languageNames[targetLanguage] || targetLanguage;

  // Create simplified segments for prompt (only what needs translation)
  const segmentsForPrompt = segments.map((s, index) => ({
    index,
    participant_name: s.participant_name,
    text: s.text,
  }));

  return `You are a professional translator specializing in educational content translation.

**Your Task:**
Translate the following lecture transcript segments from ${originalLanguageName} to ${targetLanguageName}.

**Instructions:**
1. Translate ONLY the "text" field of each segment
2. Keep "participant_name" unchanged (names should not be translated)
3. Maintain the exact same structure and order
4. Preserve academic tone and clarity
5. Use natural, fluent ${targetLanguageName} appropriate for students

**Original Transcript Segments:**
${JSON.stringify(segmentsForPrompt, null, 2)}

**Required JSON Output Format:**
Return ONLY a valid JSON array with NO markdown, NO code blocks, NO explanations. Use this EXACT structure:

[
  {
    "index": 0,
    "participant_name": "keep original name",
    "text": "TRANSLATED TEXT IN ${targetLanguageName}"
  },
  {
    "index": 1,
    "participant_name": "keep original name",
    "text": "TRANSLATED TEXT IN ${targetLanguageName}"
  }
]

**Important Requirements:**
- Return ONLY the JSON array
- NO markdown code blocks (\`\`\`json)
- NO additional text before or after the JSON
- Translate all text to ${targetLanguageName}
- Maintain educational quality and clarity
- Keep the same number of segments (${segments.length})

Begin your response with the opening bracket [ of the JSON array.`;
}

/**
 * Parse and validate Gemini translation response
 */
function parseTranslationResponse(
  response: string,
  originalSegments: TranscriptSegment[],
): TranscriptSegment[] {
  try {
    // Remove potential markdown code blocks
    let cleanedResponse = response.trim();
    cleanedResponse = cleanedResponse.replace(/```json\n?|\n?```/g, '');
    cleanedResponse = cleanedResponse.trim();

    // Parse JSON
    const parsed = JSON.parse(cleanedResponse);

    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    if (parsed.length !== originalSegments.length) {
      throw new Error(
        `Segment count mismatch: expected ${originalSegments.length}, got ${parsed.length}`,
      );
    }

    // Reconstruct full segments with translated text
    const translatedSegments: TranscriptSegment[] = parsed.map((item, index) => {
      if (typeof item.text !== 'string' || item.text.trim().length === 0) {
        throw new Error(`Invalid translation at index ${index}`);
      }

      return {
        participant_name: originalSegments[index].participant_name,
        text: item.text.trim(),
        timestamp_ms: originalSegments[index].timestamp_ms,
        language: originalSegments[index].language, // Keep original language code for reference
      };
    });

    return translatedSegments;
  } catch (error) {
    console.error('[Translate Transcript API] Failed to parse response:', error);
    console.error('[Translate Transcript API] Raw response:', response.substring(0, 500));
    throw new Error(
      `Failed to parse translation response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
