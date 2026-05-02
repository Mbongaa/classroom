'use client';

import * as React from 'react';
import { Paperclip } from './Paperclip';

const VIDEO_RE = /\.(mp4|webm|mov)$/i;

interface PhoneMockupProps {
  /** Path to a portrait screenshot (jpg/png/webp) or video (mp4/webm/mov).
   * Detected by extension; video sources autoplay muted+looping. */
  screenshot: string;
  /** Alt text — describe what's visible on screen. */
  alt: string;
  /** Slight tilt for corkboard variance. Small angles only — keep < 6°. */
  rotate?: number;
  /** Override CSS transform-origin for the rotation. Default "center". */
  transformOrigin?: string;
  /** Pin it to the wall with a small paperclip on top. */
  pinned?: boolean;
  /** Render the small side-button hints. Off in compact layouts. */
  showSideButtons?: boolean;
  /** Caption shown below the phone in handwritten font. */
  caption?: string;
  /** Tone-of-voice subline below the caption. */
  sublabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * iPhone-shaped frame around a portrait screenshot. The screenshot itself
 * already includes iOS status bar + Safari chrome, so the bezel is intentionally
 * thin — just a band of darkness around the rounded screen, no fake notch.
 */
export function PhoneMockup({
  screenshot,
  alt,
  rotate = 0,
  transformOrigin,
  pinned = false,
  showSideButtons = true,
  caption,
  sublabel,
  className = '',
  style,
}: PhoneMockupProps) {
  return (
    <figure
      className={className}
      style={{
        position: 'relative',
        margin: 0,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        transformOrigin,
        transition: 'transform 220ms var(--mkt-ease-snap)',
        ...style,
      }}
    >
      {pinned && (
        <Paperclip
          size="sm"
          rotate={3}
          offsetTop={-14}
          left="50%"
          style={{ transform: 'translateX(-50%) rotate(3deg)' }}
        />
      )}

      <div
        style={{
          background: '#0a0a0a',
          padding: 8,
          borderRadius: 42,
          boxShadow:
            '0 1px 1px rgba(0,0,0,0.18), 0 22px 50px rgba(45,45,45,0.22), 6px 6px 0 0 var(--mkt-border)',
          border: '2px solid var(--mkt-border)',
          width: 'min(220px, 100%)',
        }}
      >
        <div
          style={{
            position: 'relative',
            background: '#000',
            borderRadius: 34,
            overflow: 'hidden',
            aspectRatio: '9 / 19.5',
          }}
        >
          {VIDEO_RE.test(screenshot) ? (
            <video
              src={screenshot}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={alt}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshot}
              alt={alt}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}

          {/* Side-button hints — purely visual, sit outside the screen */}
          {showSideButtons && (
            <>
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '20%',
                  left: -10,
                  width: 3,
                  height: 26,
                  background: '#1a1a1a',
                  borderRadius: 2,
                  boxShadow: '-1px 0 0 rgba(0,0,0,0.35)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '32%',
                  left: -10,
                  width: 3,
                  height: 38,
                  background: '#1a1a1a',
                  borderRadius: 2,
                  boxShadow: '-1px 0 0 rgba(0,0,0,0.35)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '24%',
                  right: -10,
                  width: 3,
                  height: 54,
                  background: '#1a1a1a',
                  borderRadius: 2,
                  boxShadow: '1px 0 0 rgba(0,0,0,0.35)',
                }}
              />
            </>
          )}
        </div>
      </div>

      {(caption || sublabel) && (
        <figcaption
          style={{
            marginTop: 18,
            textAlign: 'center',
            paddingInline: '0.5rem',
          }}
        >
          {caption && (
            <div
              style={{
                fontFamily: 'var(--mkt-font-display)',
                fontSize: '1.15rem',
                color: 'var(--mkt-fg)',
                lineHeight: 1.2,
              }}
            >
              {caption}
            </div>
          )}
          {sublabel && (
            <div
              style={{
                fontFamily: 'var(--mkt-font-body)',
                fontSize: '0.95rem',
                color: 'var(--mkt-fg-muted)',
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {sublabel}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}
