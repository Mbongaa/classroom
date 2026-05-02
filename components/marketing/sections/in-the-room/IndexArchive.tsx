'use client';

import * as React from 'react';
import { MapPin, Languages, Users, type LucideIcon } from 'lucide-react';
import { StickyTag, PaperUnderline } from '@/components/marketing/sketch';
import { mosqueClips, type MosqueClip } from './clipsData';
import { MosqueClipFrame } from './MosqueClipFrame';
import { Paperclip } from './Paperclip';

const ARCHIVE_CLIPS = mosqueClips.slice(0, 4);

const CARD_LAYOUT: Array<{ rotate: number; mt: string; mb: string }> = [
  { rotate: -1.4, mt: '0', mb: '0' },
  { rotate: 1.8, mt: '2.5rem', mb: '0' },
  { rotate: 1.0, mt: '0', mb: '0' },
  { rotate: -2.0, mt: '2.5rem', mb: '0' },
];

const NOTE_TONES = [
  'var(--mkt-postit)',
  'var(--mkt-postit-blue)',
  'var(--mkt-postit-green)',
  'var(--mkt-postit-pink)',
];

export default function IndexArchive() {
  return (
    <section
      id="in-the-room-archive"
      className="mkt-section relative"
      style={{
        background:
          'linear-gradient(180deg, var(--mkt-bg) 0%, var(--mkt-bg-sunken) 100%)',
      }}
    >
      <div className="mkt-container">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_1fr] md:gap-14">
          <div className="max-w-xl">
            <StickyTag rotate={-1.5} tone="paper">
              field recordings · 2025
            </StickyTag>
            <h2
              className="mkt-h2 mt-6 relative inline-block"
              style={{ fontSize: 'clamp(2.25rem, 4.8vw, 3.5rem)' }}
            >
              The archive.
              <PaperUnderline
                width="80%"
                color="var(--mkt-accent)"
                style={{ position: 'absolute', left: 0, bottom: -4, width: '80%' }}
              />
            </h2>
          </div>
          <p className="mkt-lead">
            Four mosques on a contact sheet. Different cities, different languages,
            same product. Every clip is unedited. Every translation drips in live.
          </p>
        </div>

        <div className="mt-16 md:mt-20 grid gap-10 md:grid-cols-2 md:gap-12">
          {ARCHIVE_CLIPS.map((clip, i) => (
            <CaseFile
              key={clip.id}
              clip={clip}
              index={i}
              layout={CARD_LAYOUT[i]}
              noteTone={NOTE_TONES[i]}
            />
          ))}
        </div>

        {/* Footer ribbon — handwritten meta */}
        <div
          className="mt-16 md:mt-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
          style={{
            fontFamily: 'var(--mkt-font-body)',
            color: 'var(--mkt-fg-muted)',
            fontSize: '0.95rem',
          }}
        >
          <FooterStat icon={MapPin} value="14 mosques" />
          <Divider />
          <FooterStat icon={Languages} value="50+ target languages" />
          <Divider />
          <FooterStat icon={Users} value="3,400 listeners on Friday" />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function CaseFile({
  clip,
  index,
  layout,
  noteTone,
}: {
  clip: MosqueClip;
  index: number;
  layout: { rotate: number; mt: string; mb: string };
  noteTone: string;
}) {
  const [latestDripIndex, setLatestDripIndex] = React.useState<number>(-1);

  const handleTime = (t: number) => {
    const adjusted = t - 2.0;
    let idx = -1;
    clip.drips.forEach((d, i) => {
      if (adjusted >= d.at) idx = i;
    });
    setLatestDripIndex(idx);
  };

  const latestDrip = latestDripIndex >= 0 ? clip.drips[latestDripIndex] : undefined;
  const fileNo = String(index + 1).padStart(2, '0');

  return (
    <article
      style={{
        position: 'relative',
        background: '#fdfbf7',
        border: '2px solid var(--mkt-border)',
        boxShadow: '6px 6px 0 0 var(--mkt-border)',
        padding: '1rem 1rem 1.25rem',
        marginTop: layout.mt,
        marginBottom: layout.mb,
        transform: `rotate(${layout.rotate}deg)`,
        transition:
          'transform 220ms var(--mkt-ease-snap), box-shadow 220ms var(--mkt-ease-snap)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(${layout.rotate * 0.25}deg) translateY(-4px)`;
        e.currentTarget.style.boxShadow = '10px 10px 0 0 var(--mkt-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${layout.rotate}deg) translateY(0)`;
        e.currentTarget.style.boxShadow = '6px 6px 0 0 var(--mkt-border)';
      }}
    >
      {/* Paper clip */}
      <Paperclip size="md" left={18} offsetTop={-14} />

      {/* Index card row — file number + city + date */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 36,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.78rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--mkt-fg-subtle)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          file {fileNo}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            height: 1,
            borderTop: '1.5px dashed var(--mkt-border-soft)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.85rem',
            color: 'var(--mkt-fg-muted)',
          }}
        >
          {clip.country} · 2025
        </span>
      </div>

      {/* Polaroid */}
      <div style={{ position: 'relative' }}>
        <MosqueClipFrame
          videoSrc={clip.videoSrc}
          startAt={clip.startAt}
          autoPlay
          muted
          loop
          variant="thumb"
          aspect="natural"
          onTimeUpdate={handleTime}
          style={{ aspectRatio: '16 / 10' }}
        />

        {/* Floating translation chip — bottom-left, paper-strip */}
        {latestDrip && (
          <div
            key={latestDripIndex}
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              bottom: 14,
              padding: '0.6rem 0.85rem',
              background: 'rgba(253, 251, 247, 0.96)',
              border: '1.5px solid var(--mkt-border)',
              borderRadius: '14px 4px 16px 6px / 6px 18px 4px 14px',
              boxShadow: '2px 2px 0 0 rgba(45, 45, 45, 0.5)',
              animation: 'mkt-fade-up 280ms var(--mkt-ease-snap)',
              transform: 'rotate(-0.4deg)',
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
              live · {latestDrip.lang}
            </div>
            <p
              style={{
                fontFamily: 'var(--mkt-font-display)',
                color: 'var(--mkt-fg)',
                fontSize: '1rem',
                lineHeight: 1.35,
                margin: 0,
              }}
            >
              {latestDrip.translation}
            </p>
          </div>
        )}
      </div>

      {/* Caption — handwritten city + sticky language pair */}
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--mkt-font-display)',
              fontSize: '1.5rem',
              color: 'var(--mkt-fg)',
              lineHeight: 1.05,
            }}
          >
            {clip.city}
          </div>
          <div
            style={{
              fontFamily: 'var(--mkt-font-body)',
              color: 'var(--mkt-fg-muted)',
              fontSize: '0.98rem',
              marginTop: 4,
            }}
          >
            {clip.context}
          </div>
        </div>
        <span
          style={{
            background: noteTone,
            border: '2px solid var(--mkt-border)',
            borderRadius: '12px 4px 14px 6px / 6px 14px 4px 12px',
            padding: '0.35rem 0.75rem',
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.85rem',
            color: 'var(--mkt-fg)',
            letterSpacing: '0.1em',
            transform: 'rotate(2deg)',
            boxShadow: '2px 2px 0 0 var(--mkt-border)',
            whiteSpace: 'nowrap',
          }}
        >
          {clip.pair}
        </span>
      </div>
    </article>
  );
}

function FooterStat({
  icon: Icon,
  value,
}: {
  icon: LucideIcon;
  value: string;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Icon size={16} strokeWidth={2.4} />
      {value}
    </span>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'var(--mkt-border-soft)',
        display: 'inline-block',
      }}
    />
  );
}
