'use client';

import { useEffect, useRef, useState } from 'react';
import { Languages, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { BotIcon } from '@/components/ui/bot';
import { LottieIcon } from '@/components/lottie-icon';
import styles from '@/app/components/SpeechTranslationPanel.module.css';

export interface MarketingSegment {
  id: number;
  text: string;
  isLatest?: boolean;
}

interface MarketingTranslationPanelProps {
  segments: MarketingSegment[];
  targetLanguage?: string;
  participantCount?: number;
  variant?: 'desktop' | 'mobile';
}

const languageLabels: Record<string, string> = {
  en: 'English',
  nl: 'Nederlands',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
};

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 120;
const FONT_STEP = 4;

export function MarketingTranslationPanel({
  segments,
  targetLanguage = 'en',
  participantCount = 12,
  variant = 'desktop',
}: MarketingTranslationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(variant === 'mobile' ? 18 : 50);
  const [isMuted, setIsMuted] = useState(true);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Languages className={styles.bottomBarIcon} size={18} />
          <span className={styles.bottomBarTitle}>Live Translation</span>
        </div>
        <div className={styles.topBarRight}>
          <span className={styles.participantBadge} title={`${participantCount} participants`}>
            {participantCount}
          </span>
          <span className={styles.languageBadge}>
            {languageLabels[targetLanguage] ?? targetLanguage.toUpperCase()}
          </span>
          <div
            className={`${styles.agentBadge} ${styles.agentBadgeActive}`}
            title="1 agent in room"
          >
            <BotIcon size={12} />
            <span>1</span>
          </div>
          <div className={styles.liveIndicator} title="Live">
            <span className={styles.liveDot}></span>
          </div>
        </div>
      </div>

      <div className={styles.translationList} ref={scrollRef}>
        {segments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <LottieIcon src="/lottie/translate-icon.lottie" size={400} />
            </div>
            <div className={styles.emptyTitle}>Waiting for Translation</div>
            <div className={styles.emptyDescription}>
              Translations will appear here as the speaker talks
            </div>
            <div className={styles.languageIndicator}>
              <span className={styles.languageLabel}>Translating to</span>
              <span>{languageLabels[targetLanguage] ?? targetLanguage.toUpperCase()}</span>
            </div>
          </div>
        ) : (
          segments.map((segment, i) => {
            const isLatest = i === segments.length - 1;
            return (
              <div
                key={segment.id}
                className={`${styles.translationItem} ${isLatest ? styles.latest : ''}`}
              >
                <div className={styles.translationText} style={{ fontSize: `${fontSize}px` }}>
                  {segment.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomBarLeft}>
          <button
            type="button"
            onClick={() => setIsMuted((v) => !v)}
            className={`${styles.muteButton} ${isMuted ? styles.muteButtonActive : ''}`}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
            aria-label={isMuted ? 'Unmute teacher audio' : 'Mute teacher audio'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isMuted ? 'Muted' : 'Mute'}</span>
          </button>
          {segments.length > 0 && (
            <span className={styles.messageCountBadge}>{segments.length}</span>
          )}
        </div>
        <div className={styles.bottomBarRight}>
          <div className={styles.fontControls}>
            <button
              type="button"
              onClick={() => setFontSize((p) => Math.max(MIN_FONT_SIZE, p - FONT_STEP))}
              disabled={fontSize <= MIN_FONT_SIZE}
              className={styles.fontButton}
              title="Decrease font size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize((p) => Math.min(MAX_FONT_SIZE, p + FONT_STEP))}
              disabled={fontSize >= MAX_FONT_SIZE}
              className={styles.fontButton}
              title="Increase font size"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => setIsFs((v) => !v)}
              className={styles.fontButton}
              title={isFs ? 'Exit presentation mode' : 'Presentation mode'}
            >
              {isFs ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
