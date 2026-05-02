'use client';

import * as React from 'react';
import type { DripLine } from './clipsData';

interface MosqueTranslationDripProps {
  drips: DripLine[];
  /** Bound to the same video timeline as the frame next to it. */
  currentTime: number;
  /** "phone" mounts inside a phone-shaped sketch frame; "strip" is a horizontal
   * paper ribbon over the video; "panel" is a vertical card list (default). */
  variant?: 'phone' | 'strip' | 'panel';
  /** Reset state when the user swaps to a different clip. */
  resetKey?: string;
  /** Cap how many cards are visible at once (older drips slide out). */
  maxVisible?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Paper-strip translation chips that drip in synced to the video timeline.
 * The translations lag the video by ~2.5s so the rhythm matches the listener's
 * actual experience (Speechmatics + OpenAI round-trip).
 */
const PROCESSING_LAG = 2.2;

export function MosqueTranslationDrip({
  drips,
  currentTime,
  variant = 'panel',
  resetKey,
  maxVisible = 4,
  className = '',
  style,
}: MosqueTranslationDripProps) {
  const [shown, setShown] = React.useState<number[]>([]);
  const lastTimeRef = React.useRef(0);

  React.useEffect(() => {
    setShown([]);
    lastTimeRef.current = 0;
  }, [resetKey]);

  React.useEffect(() => {
    // Loop wraparound — clip restarted, clear the chips.
    if (lastTimeRef.current > 5 && currentTime < 0.6) {
      setShown([]);
    }
    lastTimeRef.current = currentTime;

    const adjusted = currentTime - PROCESSING_LAG;
    if (adjusted <= 0) return;

    drips.forEach((line, i) => {
      if (adjusted >= line.at && !shown.includes(i)) {
        setShown((prev) => [...prev, i].slice(-maxVisible));
      }
    });
  }, [currentTime, drips, maxVisible, shown]);

  const items = shown.map((i) => ({ ...drips[i], index: i }));

  if (variant === 'strip') {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          ...style,
        }}
      >
        {items.slice(-1).map((line) => (
          <div
            key={line.index}
            style={{
              background: '#fdfbf7',
              border: '2px solid var(--mkt-border)',
              borderRadius: 'var(--mkt-wobbly-md)',
              boxShadow: '4px 4px 0 0 var(--mkt-border)',
              padding: '0.85rem 1.15rem',
              transform: 'rotate(-0.4deg)',
              animation: 'mkt-fade-up 360ms var(--mkt-ease-snap)',
              maxWidth: 'min(620px, 92%)',
              marginInline: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--mkt-font-body)',
                fontSize: '0.78rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--mkt-fg-muted)',
                marginBottom: 4,
              }}
            >
              live · {line.lang}
            </div>
            <p
              style={{
                fontFamily: 'var(--mkt-font-display)',
                color: 'var(--mkt-fg)',
                fontSize: 'clamp(1.05rem, 1.6vw, 1.25rem)',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              {line.translation}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'phone') {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          width: 240,
          aspectRatio: '9 / 19',
          background: '#1a1a1a',
          border: '8px solid var(--mkt-border)',
          borderRadius: 32,
          padding: 12,
          boxShadow: '6px 6px 0 0 var(--mkt-border)',
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Speaker notch */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 56,
            height: 8,
            borderRadius: 999,
            background: '#0a0a0a',
            border: '1px solid #2a2a2a',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 22,
            left: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#bababa',
            fontFamily: 'var(--mkt-font-body)',
            fontSize: 11,
            letterSpacing: '0.08em',
          }}
        >
          <span>● Bayaan</span>
          <span>{drips[0]?.lang ?? 'EN'}</span>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 46,
            bottom: 14,
            left: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 8,
            overflow: 'hidden',
          }}
        >
          {items.map((line, i) => (
            <div
              key={`${resetKey}-${line.index}`}
              style={{
                background: i === items.length - 1 ? '#fff9c4' : '#f4f0e6',
                color: '#2d2d2d',
                fontFamily: 'var(--mkt-font-body)',
                fontSize: 13,
                lineHeight: 1.35,
                padding: '8px 10px',
                borderRadius: '14px 6px 16px 4px / 4px 18px 6px 14px',
                border: '1.5px solid #2d2d2d',
                animation: 'mkt-fade-up 360ms var(--mkt-ease-snap)',
                opacity: i === items.length - 1 ? 1 : 0.78,
              }}
            >
              {line.translation}
            </div>
          ))}
          {items.length === 0 && (
            <div
              style={{
                color: '#6a6a6a',
                fontFamily: 'var(--mkt-font-body)',
                fontSize: 12,
                textAlign: 'center',
                padding: 14,
              }}
            >
              waiting for the imam…
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: panel — a stack of paper cards
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {items.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--mkt-font-body)',
            color: 'var(--mkt-fg-subtle)',
            fontSize: '0.95rem',
            fontStyle: 'italic',
            padding: '0.5rem 0',
          }}
        >
          translation drips appear as the imam speaks…
        </div>
      )}
      {items.map((line, i) => (
        <div
          key={`${resetKey}-${line.index}`}
          style={{
            background: i === items.length - 1 ? '#fff9c4' : '#fdfbf7',
            border: '2px solid var(--mkt-border)',
            borderRadius: 'var(--mkt-wobbly-md)',
            boxShadow: i === items.length - 1
              ? '4px 4px 0 0 var(--mkt-border)'
              : '2px 2px 0 0 var(--mkt-border)',
            padding: '0.75rem 1rem',
            transform: `rotate(${i % 2 === 0 ? -0.4 : 0.5}deg)`,
            animation: 'mkt-fade-up 360ms var(--mkt-ease-snap)',
            opacity: i === items.length - 1 ? 1 : 0.85,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '0.7rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--mkt-fg-muted)',
              marginBottom: 2,
            }}
          >
            {line.lang}
          </div>
          <p
            style={{
              fontFamily: 'var(--mkt-font-display)',
              color: 'var(--mkt-fg)',
              fontSize: '1rem',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {line.translation}
          </p>
        </div>
      ))}
    </div>
  );
}
