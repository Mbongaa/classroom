'use client';

import { useEffect, useRef, useState } from 'react';
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
  variant = 'desktop',
}: MarketingTranslationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(variant === 'mobile' ? 22 : 50);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft} />
        <div className={styles.topBarRight} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
