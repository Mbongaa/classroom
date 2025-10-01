import { NextRequest, NextResponse } from 'next/server';
import { GeminiTranslator } from '@/lib/translation/gemini-translator';

export async function POST(request: NextRequest) {
  try {
    const { question, sourceLanguage, targetLanguages } = await request.json();

    // Validate inputs
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing question text' },
        { status: 400 }
      );
    }

    if (!sourceLanguage || typeof sourceLanguage !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing source language' },
        { status: 400 }
      );
    }

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing target languages array' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Translation service not configured. Please add GEMINI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Translate using Gemini
    const translator = new GeminiTranslator(process.env.GEMINI_API_KEY);
    const result = await translator.translateBatch({
      text: question,
      sourceLanguage,
      targetLanguages,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Translation API error:', error);

    // Return a more detailed error in development
    const isDevelopment = process.env.NODE_ENV === 'development';

    return NextResponse.json(
      {
        error: 'Translation failed',
        details: isDevelopment ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
