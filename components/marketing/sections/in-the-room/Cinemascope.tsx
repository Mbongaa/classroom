'use client';

import * as React from 'react';
import { Play } from 'lucide-react';
import {
  StickyTag,
  PaperUnderline,
  SquigglyLine,
} from '@/components/marketing/sketch';
import { mosqueClips } from './clipsData';
import { MosqueClipFrame } from './MosqueClipFrame';
import { MosqueTranslationDrip } from './MosqueTranslationDrip';

/**
 * Three "chapters" of a single khutbah, mapped to timestamps in the source clip.
 * When real footage drops, point each chapter at its own clip and the layout
 * keeps working (chapter polaroids re-poster automatically).
 */
const CHAPTERS = [
  {
    id: 'opening',
    at: 0,
    label: 'Opening salam',
    body: 'Assalamu alaykum to a hall of 1,200',
    tone: 'var(--mkt-postit)',
    rotate: -2.2,
  },
  {
    id: 'first-verse',
    at: 8,
    label: 'The first verse',
    body: 'Inna ahsana al-hadeeth kitabu Allah',
    tone: 'var(--mkt-postit-blue)',
    rotate: 1.4,
  },
  {
    id: 'closing-dua',
    at: 20,
    label: 'Closing dua',
    body: 'A breath. The room exhales.',
    tone: 'var(--mkt-postit-pink)',
    rotate: -1.2,
  },
] as const;

const SOURCE_CLIP = mosqueClips[0];

export default function Cinemascope() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [activeChapter, setActiveChapter] = React.useState<string>(CHAPTERS[0].id);
  const [time, setTime] = React.useState(0);

  const seekTo = (chapterId: string) => {
    const chap = CHAPTERS.find((c) => c.id === chapterId);
    if (!chap) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = chap.at;
    v.play().catch(() => {});
    setActiveChapter(chapterId);
  };

  return (
    <section
      id="in-the-room-cinemascope"
      className="mkt-section relative overflow-hidden"
    >
      <div className="mkt-container">
        <div className="mx-auto max-w-3xl text-center">
          <StickyTag rotate={1.5} tone="postit">
            ninety seconds inside
          </StickyTag>
          <h2
            className="mkt-h2 mt-6 relative inline-block"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4rem)' }}
          >
            One Friday, three chapters.
            <PaperUnderline
              width="46%"
              color="var(--mkt-accent)"
              style={{ position: 'absolute', right: '8%', bottom: -4, width: '46%' }}
            />
          </h2>
          <p className="mkt-lead mt-6" style={{ marginInline: 'auto' }}>
            We pinned three moments to the corkboard. Pick any one and the room
            jumps to that breath, captions trailing two and a half seconds behind.
          </p>
        </div>

        {/* The cinemascope frame — paper border, corner tape, dark video inside */}
        <figure
          className="relative mt-16 md:mt-20"
          style={{
            background: '#fdfbf7',
            border: '2px solid var(--mkt-border)',
            boxShadow: '14px 14px 0 0 var(--mkt-border)',
            padding: 'clamp(0.6rem, 1.5vw, 1rem)',
            transform: 'rotate(-0.5deg)',
            maxWidth: 1100,
            marginInline: 'auto',
          }}
        >
          {/* Corner tape */}
          <FrameTape position="tl" rotate={-14} hue="rgba(255, 232, 122, 0.9)" />
          <FrameTape position="tr" rotate={12} hue="rgba(216, 227, 243, 0.9)" />
          <FrameTape position="bl" rotate={10} hue="rgba(212, 236, 208, 0.9)" />
          <FrameTape position="br" rotate={-8} hue="rgba(255, 224, 224, 0.9)" />

          <div style={{ position: 'relative' }}>
            <MosqueClipFrame
              videoSrc={SOURCE_CLIP.videoSrc}
              startAt={CHAPTERS[0].at}
              videoRef={videoRef}
              onTimeUpdate={setTime}
              autoPlay
              variant="spotlight"
              aspect="wide"
            />

            {/* Floating paper-strip caption — anchored to the bottom of the video */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 18,
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <MosqueTranslationDrip
                drips={SOURCE_CLIP.drips}
                currentTime={time}
                resetKey={activeChapter}
                variant="strip"
                maxVisible={1}
              />
            </div>
          </div>

          {/* Caption ribbon underneath the frame — handwritten attribution */}
          <figcaption
            style={{
              marginTop: '0.85rem',
              padding: '0 0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--mkt-font-display)',
              color: 'var(--mkt-fg-muted)',
              fontSize: '1rem',
            }}
          >
            <span>recorded · {SOURCE_CLIP.city}, {SOURCE_CLIP.country}</span>
            <span style={{ color: 'var(--mkt-accent-deep)' }}>{SOURCE_CLIP.pair}</span>
          </figcaption>
        </figure>

        {/* Chapter scrubber — three polaroid chips */}
        <div className="mt-16 md:mt-20">
          <div className="flex items-center justify-center gap-3 mb-8">
            <SquigglyLine
              width={120}
              height={20}
              color="var(--mkt-border)"
              style={{ width: 120, height: 20, opacity: 0.55 }}
            />
            <span
              style={{
                fontFamily: 'var(--mkt-font-body)',
                color: 'var(--mkt-fg-muted)',
                fontSize: '0.85rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              chapters
            </span>
            <SquigglyLine
              width={120}
              height={20}
              color="var(--mkt-border)"
              style={{ width: 120, height: 20, opacity: 0.55 }}
            />
          </div>

          <ol
            className="grid gap-8 md:gap-10 md:grid-cols-3"
            role="tablist"
            aria-label="Chapters"
            style={{ counterReset: 'chapter' }}
          >
            {CHAPTERS.map((chap, i) => {
              const isActive = chap.id === activeChapter;
              return (
                <li key={chap.id}>
                  <button
                    type="button"
                    onClick={() => seekTo(chap.id)}
                    role="tab"
                    aria-selected={isActive}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: '#fdfbf7',
                      border: `2px solid var(--mkt-border)`,
                      boxShadow: isActive
                        ? '8px 8px 0 0 var(--mkt-accent)'
                        : '5px 5px 0 0 var(--mkt-border)',
                      padding: '0.65rem 0.65rem 1.1rem',
                      transform: `rotate(${chap.rotate}deg)`,
                      cursor: 'pointer',
                      position: 'relative',
                      textAlign: 'left',
                      font: 'inherit',
                      transition: 'transform 200ms var(--mkt-ease-snap), box-shadow 200ms var(--mkt-ease-snap)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = `rotate(${chap.rotate * 0.3}deg) translateY(-3px)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = `rotate(${chap.rotate}deg)`;
                    }}
                  >
                    {/* Chapter-still frame */}
                    <div style={{ position: 'relative' }}>
                      <MosqueClipFrame
                        videoSrc={SOURCE_CLIP.videoSrc}
                        startAt={chap.at}
                        muted
                        autoPlay={false}
                        loop={false}
                        variant="thumb"
                        aspect="natural"
                        style={{ aspectRatio: '16 / 10' }}
                      />
                      {/* Postit chapter number */}
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: -10,
                          left: -10,
                          width: 42,
                          height: 42,
                          display: 'grid',
                          placeItems: 'center',
                          background: chap.tone,
                          border: '2px solid var(--mkt-border)',
                          borderRadius: '50% 45% 55% 50% / 48% 52% 48% 52%',
                          boxShadow: '3px 3px 0 0 var(--mkt-border)',
                          fontFamily: 'var(--mkt-font-display)',
                          fontWeight: 700,
                          fontSize: '1.15rem',
                          color: 'var(--mkt-fg)',
                          transform: 'rotate(-8deg)',
                        }}
                      >
                        {i + 1}
                      </span>
                      {/* Play hint */}
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 10,
                          width: 36,
                          height: 36,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(253, 251, 247, 0.94)',
                          border: '1.5px solid var(--mkt-border)',
                          borderRadius: 999,
                          color: 'var(--mkt-fg)',
                        }}
                      >
                        <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
                      </span>
                    </div>

                    {/* Caption */}
                    <div className="mt-4 px-1">
                      <div
                        style={{
                          fontFamily: 'var(--mkt-font-display)',
                          fontSize: '1.25rem',
                          color: 'var(--mkt-fg)',
                          lineHeight: 1.15,
                        }}
                      >
                        {chap.label}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--mkt-font-body)',
                          color: 'var(--mkt-fg-muted)',
                          fontSize: '0.95rem',
                          marginTop: 4,
                          lineHeight: 1.45,
                        }}
                      >
                        {chap.body}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--mkt-font-body)',
                          color: isActive ? 'var(--mkt-accent-deep)' : 'var(--mkt-fg-subtle)',
                          fontSize: '0.78rem',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          marginTop: 8,
                        }}
                      >
                        {isActive ? 'now playing' : `jump to ${chap.at}s`}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function FrameTape({
  position,
  rotate,
  hue,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  rotate: number;
  hue: string;
}) {
  const top = position.startsWith('t') ? -10 : undefined;
  const bottom = position.startsWith('b') ? -10 : undefined;
  const left = position.endsWith('l') ? '4%' : undefined;
  const right = position.endsWith('r') ? '4%' : undefined;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top,
        bottom,
        left,
        right,
        width: 110,
        height: 24,
        background: hue,
        border: '1px solid rgba(45, 45, 45, 0.22)',
        borderRadius: 2,
        transform: `rotate(${rotate}deg)`,
        zIndex: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    />
  );
}
