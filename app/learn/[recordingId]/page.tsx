'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import LearningContentDisplay from '@/app/components/LearningContentDisplay';
import { LearningContent } from '@/lib/gemini/learning-content-generator';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { TranscriptSegment } from '@/lib/types';

interface LearningContentResponse {
  success: boolean;
  data: LearningContent;
  metadata: {
    recordingId: string;
    roomName: string;
    teacherName: string | null;
    targetLanguage: string;
    transcriptionCount: number;
    generationTimeMs: number;
  };
  recording: {
    hlsPlaylistUrl: string | null;
    mp4Url: string | null;
    durationSeconds: number | null;
    status: string;
    startedAt: string;
  };
  transcript: {
    segments: TranscriptSegment[];
    originalLanguage: string;
  };
}

/**
 * Public Learning Page
 *
 * Accessible without authentication for students to view AI-generated learning content.
 * URL format: /learn/[recordingId]?lang=en
 *
 * Features:
 * - Language-specific content generation
 * - Loading states with progress indication
 * - Error handling with retry
 * - Print functionality
 * - Share link capability
 */
export default function LearningPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const recordingId = params?.recordingId as string;
  const targetLanguage = searchParams?.get('lang') || 'en';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learningContent, setLearningContent] = useState<LearningContentResponse | null>(null);

  useEffect(() => {
    if (recordingId && targetLanguage) {
      fetchLearningContent();
    }
  }, [recordingId, targetLanguage]);

  const fetchLearningContent = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Learning Page] Fetching content for:', {
        recordingId,
        targetLanguage,
      });

      const response = await fetch(`/api/recordings/${recordingId}/learning-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate learning content');
      }

      const data: LearningContentResponse = await response.json();

      console.log('[Learning Page] ✅ Content loaded successfully:', {
        keyPoints: data.data.summary.key_points.length,
        themes: data.data.thematic_breakdown.length,
        generationTime: data.metadata.generationTimeMs,
      });

      setLearningContent(data);
    } catch (err) {
      console.error('[Learning Page] ❌ Failed to load content:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background px-4 py-8">
        <div className="text-center space-y-6 max-w-md">
          <PulsatingLoader />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Building Your Learning Page</h2>
            <p className="text-muted-foreground">
              AI is analyzing the lecture and creating structured learning content in{' '}
              <span className="font-semibold">{targetLanguage.toUpperCase()}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              This may take 10-30 seconds depending on lecture length...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background px-4 py-8">
        <Card className="max-w-md border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Failed to Load Learning Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={fetchLearningContent} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - render learning content (has its own h-screen layout)
  if (learningContent) {
    return (
      <LearningContentDisplay
        content={learningContent.data}
        metadata={{
          roomName: learningContent.metadata.roomName,
          teacherName: learningContent.metadata.teacherName || undefined,
          targetLanguage: learningContent.metadata.targetLanguage,
        }}
        recording={
          learningContent.recording.hlsPlaylistUrl
            ? {
                hlsPlaylistUrl: learningContent.recording.hlsPlaylistUrl,
                mp4Url: learningContent.recording.mp4Url || undefined,
                durationSeconds: learningContent.recording.durationSeconds || undefined,
              }
            : undefined
        }
        transcript={
          learningContent.transcript.segments.length > 0
            ? {
                segments: learningContent.transcript.segments,
                originalLanguage: learningContent.transcript.originalLanguage,
              }
            : undefined
        }
      />
    );
  }

  return null;
}
