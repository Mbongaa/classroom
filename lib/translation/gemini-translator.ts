import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguages: string[];
}

export interface TranslationResult {
  translations: { [languageCode: string]: string };
}

export class GeminiTranslator {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash for the current SDK version
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async translateBatch(request: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLanguage, targetLanguages } = request;

    // Create a comprehensive translation prompt
    const prompt = `Translate the following text from ${sourceLanguage} to multiple languages.

Text to translate: "${text}"

Target languages: ${targetLanguages.join(', ')}

Return ONLY a JSON object with this exact format (no markdown, no explanation, no code blocks):
{
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "fr": "French translation",
    ...
  }
}

IMPORTANT: Include a translation for EACH of these language codes: ${targetLanguages.join(', ')}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Remove potential markdown code blocks
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);

      // Validate that we have translations for all requested languages
      const missingLanguages = targetLanguages.filter((lang) => !parsed.translations[lang]);
      if (missingLanguages.length > 0) {
        console.warn('Missing translations for languages:', missingLanguages);
        // Fill in missing languages with source text as fallback
        missingLanguages.forEach((lang) => {
          parsed.translations[lang] = text;
        });
      }

      return parsed;
    } catch (error) {
      console.error('Gemini translation failed:', error);

      // Create fallback response with original text
      const fallbackTranslations: { [key: string]: string } = {};
      targetLanguages.forEach((lang) => {
        fallbackTranslations[lang] = text;
      });

      return { translations: fallbackTranslations };
    }
  }
}
