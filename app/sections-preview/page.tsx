'use client';

import { useEffect } from 'react';
import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import PolaroidWall from '@/components/marketing/sections/in-the-room/PolaroidWall';
import Cinemascope from '@/components/marketing/sections/in-the-room/Cinemascope';
import IndexArchive from '@/components/marketing/sections/in-the-room/IndexArchive';

/**
 * Preview-only route for picking the "In the Room" framework. Not linked from
 * the live nav. Mount it at /sections-preview while comparing — drop the
 * winning section into LandingPage.tsx (between UseCases and Testimonials)
 * and delete this folder when done.
 */
export default function SectionsPreviewPage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mkt-active');
    return () => {
      root.classList.remove('mkt-active');
    };
  }, []);

  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingNavigation />
      <main>
        <FrameworkLabel
          label="Framework A"
          name="Polaroid Wall"
          tone="var(--mkt-postit)"
          description="A spotlight polaroid swaps with whichever thumbnail you tap. Listener's phone propped beside it, drips synced 2.5s behind."
        />
        <PolaroidWall />

        <FrameworkLabel
          label="Framework B"
          name="Cinemascope"
          tone="var(--mkt-postit-blue)"
          description="One wide cinematic frame with floating paper-strip captions. Three chapter polaroids scrub the timeline. Quieter, more focused."
        />
        <Cinemascope />

        <FrameworkLabel
          label="Framework C"
          name="Index Archive"
          tone="var(--mkt-postit-green)"
          description="Four equal case files on a contact sheet. All clips play at once. Translation chip floats over each polaroid as it streams."
        />
        <IndexArchive />

        <Closer />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function FrameworkLabel({
  label,
  name,
  tone,
  description,
}: {
  label: string;
  name: string;
  tone: string;
  description: string;
}) {
  return (
    <div
      className="mkt-container relative"
      style={{ paddingTop: 'clamp(3rem, 6vw, 5rem)', paddingBottom: '0' }}
    >
      <div className="grid items-end gap-6 md:grid-cols-[auto_1fr] md:gap-8">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 14,
            background: tone,
            border: '2px solid var(--mkt-border)',
            borderRadius: 'var(--mkt-wobbly-md)',
            padding: '0.85rem 1.4rem 1rem',
            boxShadow: '6px 6px 0 0 var(--mkt-border)',
            transform: 'rotate(-1.4deg)',
            alignSelf: 'flex-start',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mkt-fg-muted)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: 'var(--mkt-font-display)',
              fontSize: '1.65rem',
              fontWeight: 700,
              color: 'var(--mkt-fg)',
            }}
          >
            {name}
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--mkt-font-body)',
            color: 'var(--mkt-fg-muted)',
            fontSize: '1.05rem',
            lineHeight: 1.6,
            maxWidth: '46rem',
          }}
        >
          {description}
        </p>
      </div>
      {/* Section divider line — handdrawn dashed */}
      <span
        aria-hidden
        style={{
          display: 'block',
          marginTop: '2rem',
          height: 1,
          borderTop: '2px dashed var(--mkt-border-soft)',
        }}
      />
    </div>
  );
}

function Closer() {
  return (
    <section
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mkt-h2" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}>
            Pick one. Mix two. Or commission a fourth.
          </h2>
          <p
            className="mkt-lead mt-6"
            style={{ marginInline: 'auto' }}
          >
            Tell me which framework wins (or which two should sit back-to-back) and
            I&apos;ll wire it into the live landing page between Use Cases and
            Testimonials.
          </p>
        </div>
      </div>
    </section>
  );
}
