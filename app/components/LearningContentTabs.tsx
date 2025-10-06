'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@heroui/react';
import { Video, FileText, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoPlayer from './VideoPlayer';
import TranscriptDisplay from './TranscriptDisplay';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import { TranscriptSegment } from '@/lib/types';
import { LearningContent } from '@/lib/gemini/learning-content-generator';

interface TabData {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface LearningContentTabsProps {
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
  transcriptView: 'original' | 'translated';
  translatedSegments: TranscriptSegment[] | null;
  translating: boolean;
  translationError: string | null;
  onTranscriptToggle: () => void;
}

export function LearningContentTabs({
  content,
  metadata,
  recording,
  transcript,
  transcriptView,
  translatedSegments,
  translating,
  translationError,
  onTranscriptToggle,
}: LearningContentTabsProps) {
  const { summary, thematic_breakdown } = content;
  const [activeTab, setActiveTab] = useState('');
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, left: 0, width: 0 });
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Build tabs array dynamically
  const tabs: TabData[] = useMemo(() => {
    const tabsArray: TabData[] = [];

    // Recording tab
    if (recording) {
      tabsArray.push({
      id: 'recording',
      label: 'Recording',
      icon: Video,
      content: (
        <div className="h-full">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Video className="h-6 w-6 text-primary" />
            Lecture Recording
          </h2>
          <div
            className="overflow-y-auto"
            style={{
              height: 'calc(100vh - 20rem)',
              maxHeight: 'calc(100vh - 20rem)',
            }}
          >
            <VideoPlayer
              hlsPlaylistUrl={recording.hlsPlaylistUrl}
              mp4Url={recording.mp4Url}
              recordingId={metadata?.roomName || 'recording'}
              showDownload={true}
            />
            {recording.durationSeconds && (
              <div className="mt-4 text-sm text-muted-foreground">
                Duration: {Math.floor(recording.durationSeconds / 60)} minutes{' '}
                {recording.durationSeconds % 60} seconds
              </div>
            )}
          </div>
        </div>
      ),
      });
    }

    // Transcript tab
    if (transcript && transcript.segments.length > 0) {
      tabsArray.push({
      id: 'transcript',
      label: 'Transcript',
      icon: FileText,
      content: (
        <div className="h-full">
          {/* Header with Toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Lecture Transcript
            </h2>

            {/* Language Toggle */}
            <div className="flex items-center gap-3 print:hidden">
              <span
                className={`text-sm ${transcriptView === 'original' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Original ({transcript.originalLanguage.toUpperCase()})
              </span>
              <Switch
                isSelected={transcriptView === 'translated'}
                onValueChange={onTranscriptToggle}
                isDisabled={translating}
                size="sm"
              />
              <span
                className={`text-sm ${transcriptView === 'translated' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Translated ({metadata?.targetLanguage?.toUpperCase() || 'EN'})
              </span>
            </div>
          </div>

          {/* Transcript Content with Scroll */}
          <div
            className="overflow-y-auto"
            style={{
              height: 'calc(100vh - 24rem)',
              maxHeight: 'calc(100vh - 24rem)',
            }}
          >
            {translating ? (
              <div className="flex flex-col items-center justify-center p-12">
                <PulsatingLoader />
                <p className="mt-4 text-muted-foreground">Translating transcript...</p>
              </div>
            ) : translationError && transcriptView === 'translated' ? (
              <div className="p-8 text-center text-destructive">
                <p>{translationError}</p>
                <Button
                  onClick={() => onTranscriptToggle()}
                  variant="outline"
                  className="mt-4"
                >
                  View Original
                </Button>
              </div>
            ) : (
              <TranscriptDisplay
                segments={
                  transcriptView === 'original'
                    ? transcript.segments
                    : translatedSegments || transcript.segments
                }
                language={
                  transcriptView === 'original'
                    ? transcript.originalLanguage
                    : metadata?.targetLanguage || 'en'
                }
              />
            )}
          </div>
        </div>
      ),
      });
    }

    // Summary tab
    tabsArray.push({
    id: 'summary',
    label: 'Summary',
    icon: Lightbulb,
    content: (
      <div className="h-full">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          {summary.title}
        </h2>
        <div
          className="overflow-y-auto"
          style={{
            height: 'calc(100vh - 20rem)',
            maxHeight: 'calc(100vh - 20rem)',
          }}
        >
          <div className="space-y-4">
            {summary.key_points.map((point, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-default-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-base leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    });

    // Theme tabs
    thematic_breakdown.forEach((theme, index) => {
      tabsArray.push({
      id: `theme-${index}`,
      label: `Theme ${index + 1}`,
      icon: ({ className }) => (
        <span className={cn('flex items-center justify-center text-sm font-bold', className)}>
          {index + 1}
        </span>
      ),
      content: (
        <div className="h-full">
          <div className="flex items-start gap-3 mb-6">
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
              {index + 1}
            </span>
            <h2 className="text-2xl font-bold pt-1">{theme.theme_title}</h2>
          </div>
          <div
            className="overflow-y-auto"
            style={{
              height: 'calc(100vh - 20rem)',
              maxHeight: 'calc(100vh - 20rem)',
            }}
          >
            <div className="space-y-4">
              {theme.theme_content.split('\n\n').map((paragraph, pIndex) => (
                <p key={pIndex} className="text-base leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      ),
      });
    });

    return tabsArray;
  }, [recording, transcript, transcriptView, translating, translationError, translatedSegments, metadata, onTranscriptToggle, summary, thematic_breakdown]);

  // Set initial active tab
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Update indicator position
  useEffect(() => {
    const activeButton = tabRefs.current[activeTab];
    if (activeButton) {
      const { offsetTop, offsetHeight, offsetLeft, offsetWidth } = activeButton;
      setIndicatorStyle({
        top: offsetTop,
        height: offsetHeight,
        left: offsetLeft,
        width: offsetWidth,
      });
    }
  }, [activeTab]);

  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Vertical Tab List - Horizontal on mobile */}
      <div className="overflow-x-auto md:overflow-x-visible">
        <div className="relative flex gap-2 md:flex-col">
          <div
            className="absolute rounded-lg bg-primary transition-all duration-300 ease-out md:left-0"
            style={{
              top: `${indicatorStyle.top}px`,
              height: `${indicatorStyle.height}px`,
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative z-10 flex min-w-[140px] items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-200 md:min-w-0 md:w-full',
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-transform duration-300',
                    isActive && 'scale-110',
                  )}
                />
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <Card className="overflow-hidden">
        <div key={activeTab} className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="p-6 md:p-8">{activeTabData?.content}</div>
        </div>
      </Card>
    </div>
  );
}
