'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeOff } from 'lucide-react';
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
  isStreamMuted?: boolean;
  onToggleStreamMute?: () => void;
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
  isStreamMuted,
  onToggleStreamMute,
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
          {onToggleStreamMute &&
            (isStreamMuted ? (
              <div className="relative inline-flex">
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ scale: 2.4, opacity: [0.55, 0] }}
                    transition={{
                      duration: 2,
                      delay: i * 1,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 9999,
                      backgroundColor: 'var(--mkt-accent, #ff4d4d)',
                      pointerEvents: 'none',
                      transformOrigin: 'center',
                      willChange: 'transform, opacity',
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={onToggleStreamMute}
                  aria-label="Unmute audio"
                  title="Tap to hear the audio"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 9999,
                    backgroundColor: 'var(--mkt-accent, #ff4d4d)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(255, 77, 77, 0.45)',
                  }}
                >
                  <VolumeOff style={{ width: 16, height: 16 }} />
                  Tap to hear
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onToggleStreamMute}
                aria-label="Mute audio"
                title="Mute"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 9999,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Volume2 style={{ width: 16, height: 16 }} />
                Mute
              </button>
            ))}
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
