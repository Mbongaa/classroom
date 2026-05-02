'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  StickyTag,
  PaperUnderline,
  DashedArrow,
  SquigglyLine,
} from '@/components/marketing/sketch';
import { mosqueClips, getClipById, type MosqueClip } from './clipsData';
import { MosqueClipFrame } from './MosqueClipFrame';
import { Paperclip } from './Paperclip';
import { PhoneMockup } from './PhoneMockup';

const PHONE_SCREENS = [
  { src: '/marketing/rachid-mobile-2.jpg', screenKey: 'live', rotate: -2.5 },
  { src: '/marketing/rachid-mobile-3.jpg', screenKey: 'fullscreen', rotate: 1.5 },
  { src: '/marketing/rachid-mobile-1.jpg', screenKey: 'everyWord', rotate: -1.2 },
] as const;

const THUMB_LAYOUT: Array<{ rotate: number; offsetX: number; offsetY: number }> = [
  { rotate: -3.2, offsetX: 0, offsetY: 0 },
  { rotate: 2.4, offsetX: 14, offsetY: 18 },
  { rotate: -1.8, offsetX: -10, offsetY: 36 },
  { rotate: 3.0, offsetX: 8, offsetY: 12 },
];

export default function PolaroidWall() {
  const t = useTranslations('marketing.inTheRoom');
  const [activeId, setActiveId] = React.useState(mosqueClips[0].id);
  const active = getClipById(activeId);
  const others = mosqueClips.filter((c) => c.id !== activeId).slice(0, 4);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Reset playhead when clip swaps so each video starts at its own offset.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = active.startAt ?? 0;
    v.play().catch(() => {});
  }, [active.id, active.startAt]);

  return (
    <section
      id="in-the-room-polaroid"
      className="mkt-section relative overflow-hidden"
      style={{
        backgroundColor: 'var(--mkt-bg-sunken)',
        backgroundImage: 'radial-gradient(var(--mkt-border-soft) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Pinned thumbtack decoration in the corner — purely ornamental. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 32,
          right: 'clamp(1rem, 6vw, 6rem)',
          width: 18,
          height: 18,
          borderRadius: 999,
          background: 'radial-gradient(circle at 35% 30%, #ff4d4d 0%, #ff4d4d 55%, #a62929 100%)',
          border: '2px solid var(--mkt-border)',
          boxShadow: '2px 2px 0 0 var(--mkt-border)',
        }}
      />

      <div className="mkt-container relative">
        <div className="grid items-end gap-8 md:grid-cols-[1.05fr_1fr] md:gap-14">
          <div className="mx-auto max-w-xl text-center md:mx-0 md:text-left">
            <StickyTag rotate={-2} tone="postit">
              {t('eyebrow')}
            </StickyTag>
            <h2
              className="mkt-h2 mt-6 relative inline-block"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)' }}
            >
              {t('titleLine1')}
              <br />
              {t('titleLine2')}
              <PaperUnderline
                width="58%"
                color="var(--mkt-accent)"
                style={{ position: 'absolute', left: 0, bottom: -4, width: '58%' }}
              />
            </h2>
          </div>
          <p className="mkt-lead text-center md:text-left mx-auto md:mx-0">
            {t('lead')}
          </p>
        </div>

        {/* The corkboard: spotlight + thumbnails + propped phone */}
        <div className="mt-16 md:mt-20 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          {/* LEFT — spotlight polaroid */}
          <div className="relative">
            <SpotlightPolaroid
              key={active.id}
              clip={active}
              videoRef={videoRef}
              context={t(`clips.${active.id}`)}
            />

            {/* Sticky-note hint with dashed arrow — only on the first interaction */}
            <div
              className="absolute hidden md:block"
              style={{
                top: -12,
                right: -28,
                transform: 'rotate(6deg)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  background: 'var(--mkt-postit)',
                  border: '2px solid var(--mkt-border)',
                  borderRadius: '12px 4px 14px 6px / 6px 16px 4px 12px',
                  padding: '0.5rem 0.85rem',
                  boxShadow: '3px 3px 0 0 var(--mkt-border)',
                  fontFamily: 'var(--mkt-font-display)',
                  color: 'var(--mkt-fg)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                }}
              >
                {t('tapHint')}
              </div>
              <DashedArrow
                direction="down-left"
                color="var(--mkt-fg)"
                width={90}
                height={70}
                style={{ position: 'absolute', top: 28, left: 64 }}
              />
            </div>
          </div>

          {/* RIGHT — thumbnail grid */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-10"
            role="tablist"
            aria-label="Mosque clips"
          >
            {others.map((clip, i) => (
              <ThumbnailPolaroid
                key={clip.id}
                clip={clip}
                layout={THUMB_LAYOUT[i % THUMB_LAYOUT.length]}
                onSelect={() => setActiveId(clip.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Phone gallery ────────────────────────────────────────────── */}
        <div className="mt-24 md:mt-32">
          <div className="mx-auto max-w-2xl text-center">
            <div
              className="flex items-center justify-center gap-3"
              aria-hidden
            >
              <SquigglyLine
                width={100}
                height={18}
                color="var(--mkt-border)"
                style={{ width: 100, height: 18, opacity: 0.55 }}
              />
              <span
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  fontSize: '0.85rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--mkt-fg-muted)',
                }}
              >
                {t('phones.eyebrow')}
              </span>
              <SquigglyLine
                width={100}
                height={18}
                color="var(--mkt-border)"
                style={{ width: 100, height: 18, opacity: 0.55 }}
              />
            </div>
            <h3
              className="mkt-h2 mt-6 relative inline-block"
              style={{ fontSize: 'clamp(2rem, 4.4vw, 3rem)' }}
            >
              {t('phones.title')}
              <PaperUnderline
                width="40%"
                color="var(--mkt-accent)"
                style={{ position: 'absolute', right: '6%', bottom: -4, width: '40%' }}
              />
            </h3>
            <p
              className="mkt-lead mt-6"
              style={{ marginInline: 'auto' }}
            >
              {t('phones.lead')}
            </p>
          </div>

          {/* MOBILE — fan-overlap. Three phones share one phone-height of vertical
             space, fanned around a common bottom point so the silhouettes nest
             like cards in a hand. Captions and side-buttons hidden for compactness. */}
          <div
            className="mt-12 md:hidden mx-auto relative"
            role="list"
            aria-label="Student phone screens"
            style={{
              width: 'min(360px, 92vw)',
              // height = phone height (~325px at ~150 width) + tilt overhang
              height: 'min(380px, calc(min(360px, 92vw) * 1.05))',
            }}
          >
            {PHONE_SCREENS.map((screen, i) => {
              const placements = [
                { side: 'left' as const, offset: '0%', rotate: -11, z: 1 },
                { side: 'center' as const, offset: '50%', rotate: 0, z: 3 },
                { side: 'right' as const, offset: '0%', rotate: 11, z: 2 },
              ];
              const p = placements[i];
              return (
                <div
                  key={screen.src}
                  role="listitem"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: p.side === 'left' ? p.offset : p.side === 'center' ? p.offset : undefined,
                    right: p.side === 'right' ? p.offset : undefined,
                    transform: p.side === 'center' ? 'translateX(-50%)' : undefined,
                    transformOrigin: 'bottom center',
                    zIndex: p.z,
                    width: '52%',
                  }}
                >
                  <PhoneMockup
                    screenshot={screen.src}
                    alt={t(`phones.screens.${screen.screenKey}.alt`)}
                    rotate={p.rotate}
                    transformOrigin="bottom center"
                    pinned={false}
                    showSideButtons={false}
                  />
                </div>
              );
            })}
          </div>

          {/* DESKTOP — flat row with slight per-card rotation + middle offset */}
          <div
            className="mt-14 md:mt-20 hidden md:flex flex-wrap items-start justify-center gap-x-10 gap-y-16 md:gap-x-14"
            role="list"
          >
            {PHONE_SCREENS.map((screen, i) => (
              <div
                key={screen.src}
                role="listitem"
                style={{
                  width: 'min(220px, 100%)',
                  marginTop: i === 1 ? '-1.5rem' : 0,
                }}
              >
                <PhoneMockup
                  screenshot={screen.src}
                  alt={t(`phones.screens.${screen.screenKey}.alt`)}
                  rotate={screen.rotate}
                  caption={t(`phones.screens.${screen.screenKey}.caption`)}
                  sublabel={t(`phones.screens.${screen.screenKey}.sublabel`)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SpotlightPolaroid({
  clip,
  videoRef,
  context,
}: {
  clip: MosqueClip;
  videoRef: React.RefObject<HTMLVideoElement>;
  context: string;
}) {
  return (
    <div
      style={{
        background: '#fdfbf7',
        border: '2px solid var(--mkt-border)',
        boxShadow: '12px 12px 0 0 var(--mkt-border)',
        padding: '1rem 1rem 1.5rem',
        transform: 'rotate(-1.5deg)',
        position: 'relative',
        animation: 'mkt-fade-up 420ms var(--mkt-ease-snap)',
      }}
    >
      {/* Wire paperclip slipped over the top edge — right side */}
      <Paperclip size="lg" rotate={8} right={36} />

      <MosqueClipFrame
        videoSrc={clip.videoSrc}
        startAt={clip.startAt}
        videoRef={videoRef}
        autoPlay
        variant="spotlight"
        aspect="natural"
        style={{ aspectRatio: '16 / 10' }}
      />

      {/* Handwritten polaroid caption */}
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div
            style={{
              fontFamily: 'var(--mkt-font-display)',
              fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
              color: 'var(--mkt-fg)',
              lineHeight: 1,
            }}
          >
            {clip.city}
            <span style={{ color: 'var(--mkt-fg-subtle)' }}>, {clip.country}</span>
          </div>
          {clip.speaker && (
            <div
              style={{
                fontFamily: 'var(--mkt-font-display)',
                fontSize: '1.1rem',
                color: 'var(--mkt-accent-deep)',
                marginTop: 4,
                fontStyle: 'italic',
              }}
            >
              {clip.speaker}
            </div>
          )}
          <div
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '1.05rem',
              color: 'var(--mkt-fg-muted)',
              marginTop: 4,
            }}
          >
            {context}
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.85rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            background: 'var(--mkt-accent)',
            color: '#fff',
            padding: '0.3rem 0.75rem',
            border: '2px solid var(--mkt-border)',
            borderRadius: '14px 4px 12px 6px / 6px 14px 4px 12px',
            transform: 'rotate(2deg)',
            boxShadow: '2px 2px 0 0 var(--mkt-border)',
            whiteSpace: 'nowrap',
          }}
        >
          {clip.pair}
        </span>
      </div>
    </div>
  );
}

function ThumbnailPolaroid({
  clip,
  layout,
  onSelect,
}: {
  clip: MosqueClip;
  layout: { rotate: number; offsetX: number; offsetY: number };
  onSelect: () => void;
}) {
  // Slight per-card paperclip variance so the wall doesn't look stamped.
  const clipRotate = (layout.rotate * 0.6) - 4;
  return (
    <button
      type="button"
      onClick={onSelect}
      role="tab"
      style={{
        background: '#fdfbf7',
        border: '2px solid var(--mkt-border)',
        boxShadow: '5px 5px 0 0 var(--mkt-border)',
        padding: '0.5rem 0.5rem 0.85rem',
        transform: `rotate(${layout.rotate}deg) translate(${layout.offsetX}px, ${layout.offsetY}px)`,
        transition: 'transform 180ms var(--mkt-ease-snap), box-shadow 180ms var(--mkt-ease-snap)',
        cursor: 'pointer',
        position: 'relative',
        textAlign: 'left',
        font: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(${layout.rotate * 0.4}deg) translate(${layout.offsetX - 2}px, ${layout.offsetY - 4}px)`;
        e.currentTarget.style.boxShadow = '8px 8px 0 0 var(--mkt-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${layout.rotate}deg) translate(${layout.offsetX}px, ${layout.offsetY}px)`;
        e.currentTarget.style.boxShadow = '5px 5px 0 0 var(--mkt-border)';
      }}
    >
      <Paperclip size="sm" rotate={clipRotate} left={18} />

      <MosqueClipFrame
        videoSrc={clip.videoSrc}
        startAt={clip.startAt}
        autoPlay
        muted
        variant="thumb"
        aspect="square"
      />

      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontFamily: 'var(--mkt-font-display)',
            fontSize: '1.05rem',
            color: 'var(--mkt-fg)',
            lineHeight: 1.1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <span>{clip.city}</span>
          <span
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--mkt-fg-muted)',
            }}
          >
            {clip.pair}
          </span>
        </div>
        {clip.speaker && (
          <div
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '0.85rem',
              color: 'var(--mkt-fg-muted)',
              marginTop: 2,
              lineHeight: 1.2,
              fontStyle: 'italic',
            }}
          >
            {clip.speaker}
          </div>
        )}
      </div>
    </button>
  );
}

