'use client';

import React, { useState } from 'react';
import { LearningContent } from '@/lib/gemini/learning-content-generator';
import { Button } from '@/components/ui/button';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { GraduationCap, Printer, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { TranscriptSegment } from '@/lib/types';
import { LearningContentTabs } from './LearningContentTabs';

interface LearningContentDisplayProps {
  content: LearningContent;
  metadata?: {
    roomName?: string;
    teacherName?: string;
    targetLanguage?: string;
  };
  recording?: {
    hlsPlaylistUrl: string;
    mp4Url?: string;
    durationSeconds?: number;
  };
  transcript?: {
    segments: TranscriptSegment[];
    originalLanguage: string;
  };
}

/**
 * LearningContentDisplay - Single-Page App with Shadcn Tabs
 *
 * Fixed-height layout with professional responsive navigation.
 * Uses custom Shadcn-based tabs for better mobile scroll behavior.
 */
export default function LearningContentDisplay({
  content,
  metadata,
  recording,
  transcript,
}: LearningContentDisplayProps) {
  // Transcript toggle state
  const [transcriptView, setTranscriptView] = useState<'original' | 'translated'>('original');
  const [translatedSegments, setTranslatedSegments] = useState<TranscriptSegment[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
    toast.success('Opening print dialog...');
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const handleTranscriptToggle = async () => {
    if (!transcript) return;

    if (transcriptView === 'original') {
      // Switching to translated
      if (!translatedSegments) {
        // Need to fetch translation
        await fetchTranslation();
      }
      setTranscriptView('translated');
    } else {
      // Switching to original
      setTranscriptView('original');
    }
  };

  const fetchTranslation = async () => {
    if (!transcript || !metadata?.targetLanguage) return;

    setTranslating(true);
    setTranslationError(null);

    try {
      // Extract recordingId from URL or metadata
      const pathParts = window.location.pathname.split('/');
      const recordingId = pathParts[pathParts.length - 1];

      const response = await fetch(`/api/recordings/${recordingId}/translate-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: metadata.targetLanguage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to translate transcript');
      }

      const data = await response.json();
      setTranslatedSegments(data.translatedSegments);
      toast.success('Transcript translated successfully!');
    } catch (error) {
      console.error('[LearningContentDisplay] Translation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to translate transcript';
      setTranslationError(errorMessage);
      toast.error(errorMessage);
      setTranscriptView('original'); // Fallback to original
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Bayaan Header - Consolidated */}
      <header className="shrink-0 h-16 border-b border-[rgba(128,128,128,0.3)] bg-background print:border-b-2">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left: Bayaan Branding + Room Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-foreground">Bayaan Classroom</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">
                {metadata?.roomName || 'Learning Content'}
              </span>
              {metadata?.teacherName && (
                <span className="text-muted-foreground">• {metadata.teacherName}</span>
              )}
            </div>
          </div>

          {/* Right: Language + Theme Toggle */}
          <div className="flex items-center gap-3">
            {metadata?.targetLanguage && (
              <div className="text-sm font-medium text-muted-foreground">
                {metadata.targetLanguage.toUpperCase()}
              </div>
            )}
            <div className="print:hidden">
              <ThemeToggleButton start="top-right" />
            </div>
          </div>
        </div>
      </header>

      {/* Content Area with Shadcn Responsive Tabs */}
      <div className="flex-1 p-6">
        <LearningContentTabs
          content={content}
          metadata={metadata}
          recording={recording}
          transcript={transcript}
          transcriptView={transcriptView}
          translatedSegments={translatedSegments}
          translating={translating}
          translationError={translationError}
          onTranscriptToggle={handleTranscriptToggle}
        />
      </div>

      {/* Fixed Footer */}
      <footer className="shrink-0 h-14 border-t border-[rgba(128,128,128,0.3)] bg-background px-6 flex items-center justify-between print:border-t-2">
        <div className="text-sm text-muted-foreground print:text-black">
          Generated with AI •{' '}
          {new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </footer>
    </div>
  );
}
