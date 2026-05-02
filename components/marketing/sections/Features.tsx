'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Languages,
  HandCoins,
  Repeat,
  FileSignature,
  Lock,
} from 'lucide-react';
import {
  SketchCard,
  StickyTag,
  PaperUnderline,
} from '@/components/marketing/sketch';
import { PhoneMockup } from '@/components/marketing/sections/in-the-room/PhoneMockup';

// Donation-led ordering. Three tabs walk through how money moves through
// bayaan: a one-off iDeal/card donation, the SEPA mandate the donor signs,
// and the monthly auto-collection that runs after.
const tabs = [
  { id: 'donations', icon: HandCoins },
  { id: 'mandates', icon: FileSignature },
  { id: 'recurring', icon: Repeat },
] as const;

// Each tab gets its own preview surface — donations and mandates show the
// real donor flow on a phone; recurring shows a screenshot of the mosque-admin
// members dashboard where the automatic SEPA collection runs.
type PreviewConfig =
  | { kind: 'phone'; src: string; alt: string }
  | { kind: 'dashboard-image'; src: string; alt: string };

const PREVIEW_BY_TAB: Record<typeof tabs[number]['id'], PreviewConfig> = {
  donations: {
    kind: 'phone',
    src: '/marketing/sadaqah-alabraar.mp4',
    alt: 'Donor giving a one-time sadaqah on their phone',
  },
  mandates: {
    kind: 'phone',
    src: '/marketing/mandaat-alabraar.mp4',
    alt: 'Donor signing a SEPA mandate on their phone',
  },
  recurring: {
    kind: 'dashboard-image',
    src: '/marketing/automatic-incassos.png',
    alt: 'Mosque admin members dashboard listing recurring donors with active SEPA mandates',
  },
};

const featureItems = [
  {
    key: 'donations',
    icon: HandCoins,
    tone: 'postit' as const,
    rotate: -1.5,
    decoration: 'tape' as const,
    span: 'lg:col-span-2',
  },
  {
    key: 'members',
    icon: Repeat,
    tone: 'paper' as const,
    rotate: 1.8,
    decoration: 'tack' as const,
    span: 'lg:col-span-1',
  },
  {
    key: 'translation',
    icon: Languages,
    tone: 'paper' as const,
    rotate: -1,
    decoration: 'tack-blue' as const,
    span: 'lg:col-span-1',
  },
] as const;

export default function Features() {
  const t = useTranslations('marketing.features');
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('donations');

  return (
    <section id="features" className="mkt-section">
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <StickyTag rotate={-2} tone="postit">
            {t('eyebrow')}
          </StickyTag>
          <h2 className="mkt-h2 mt-6 inline-block relative">
            {t('title')}
            <PaperUnderline
              color="var(--mkt-secondary)"
              style={{
                position: 'absolute',
                left: '15%',
                bottom: -6,
                width: '70%',
              }}
            />
          </h2>
          <p className="mkt-lead mt-6 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        {/* Sketch tabs — wobbly pill buttons */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={active}
                className="mkt-focus-ring inline-flex items-center gap-2 transition-transform duration-100"
                style={{
                  background: active ? 'var(--mkt-accent)' : 'var(--mkt-bg-elev)',
                  color: active ? 'var(--mkt-bg-elev)' : 'var(--mkt-fg)',
                  border: `2px solid var(--mkt-border)`,
                  borderRadius: 'var(--mkt-wobbly-pill)',
                  boxShadow: active
                    ? '2px 2px 0 0 var(--mkt-border)'
                    : '4px 4px 0 0 var(--mkt-border)',
                  fontFamily: 'var(--mkt-font-body)',
                  fontSize: '1rem',
                  // Min finger target per WCAG 2.5.5 (44×44).
                  minHeight: 44,
                  padding: '0.75rem 1.25rem',
                  transform: active ? 'translate(2px, 2px)' : 'rotate(-0.6deg)',
                }}
              >
                <Icon size={16} strokeWidth={2.6} aria-hidden />
                <span>{t(`tabs.${tab.id}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab preview surface — phone floats free, dashboard sits in a polaroid frame */}
        {PREVIEW_BY_TAB[activeTab].kind === 'phone' ? (
          <PhoneTabPreview activeTab={activeTab} />
        ) : (
          <DashboardTabPreview activeTab={activeTab} />
        )}

        {/* Asymmetric bento feature cards */}
        <div className="mt-20 grid gap-7 lg:grid-cols-4">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <SketchCard
                key={item.key}
                tone={item.tone}
                decoration={item.decoration}
                rotate={item.rotate}
                hoverJiggle
                className={item.span}
                radiusVariant={item.tone === 'postit' ? 'b' : 'a'}
                style={{
                  paddingTop: item.decoration === 'tack' || item.decoration === 'tack-blue' ? '2.5rem' : undefined,
                }}
              >
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center"
                  style={{
                    background: 'var(--mkt-accent)',
                    color: 'var(--mkt-bg-elev)',
                    border: '2.5px solid var(--mkt-border)',
                    borderRadius: 'var(--mkt-wobbly-blob-1)',
                    boxShadow: '3px 3px 0 0 var(--mkt-border)',
                  }}
                >
                  <Icon size={22} strokeWidth={2.6} aria-hidden />
                </div>
                <h3 className="mkt-h3" style={{ fontSize: '1.5rem' }}>
                  {t(`items.${item.key}.title`)}
                </h3>
                <p
                  className="mt-3"
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    color: 'var(--mkt-fg-muted)',
                    fontSize: '1.05rem',
                    lineHeight: 1.6,
                  }}
                >
                  {t(`items.${item.key}.body`)}
                </p>
              </SketchCard>
            );
          })}
        </div>

      </div>
    </section>
  );
}

type TabId = typeof tabs[number]['id'];

function PhoneTabPreview({ activeTab }: { activeTab: TabId }) {
  const cfg = PREVIEW_BY_TAB[activeTab];
  if (cfg.kind !== 'phone') return null;
  return (
    <div key={activeTab} className="mt-12 flex justify-center">
      <div style={{ width: 'min(360px, 86vw)' }}>
        <PhoneMockup
          screenshot={cfg.src}
          alt={cfg.alt}
          rotate={-1.5}
          showSideButtons
        />
      </div>
    </div>
  );
}

function DashboardTabPreview({ activeTab }: { activeTab: TabId }) {
  const cfg = PREVIEW_BY_TAB[activeTab];
  if (cfg.kind !== 'dashboard-image') return null;
  return (
    <div
      key={activeTab}
      className="relative mx-auto mt-10"
      style={{ maxWidth: '1080px', transform: 'rotate(-0.6deg)' }}
    >
      {/* Tape strips */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -14,
          left: 60,
          transform: 'rotate(-7deg)',
          width: 96,
          height: 24,
          background: 'rgba(80, 80, 80, 0.18)',
          border: '1px solid rgba(45, 45, 45, 0.18)',
          borderRadius: 2,
          zIndex: 2,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -14,
          right: 60,
          transform: 'rotate(6deg)',
          width: 96,
          height: 24,
          background: 'rgba(80, 80, 80, 0.18)',
          border: '1px solid rgba(45, 45, 45, 0.18)',
          borderRadius: 2,
          zIndex: 2,
        }}
      />

      <div
        style={{
          background: 'var(--mkt-bg-elev)',
          border: '3px solid var(--mkt-border)',
          borderRadius: 'var(--mkt-wobbly-md)',
          boxShadow: '8px 8px 0 0 var(--mkt-border)',
          overflow: 'hidden',
        }}
      >
        <BrowserChrome activeTab={activeTab} />
        <div style={{ background: '#0a0a0a', display: 'block', lineHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cfg.src}
            alt={cfg.alt}
            loading="lazy"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}

function BrowserChrome({ activeTab }: { activeTab: TabId }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3"
      style={{
        background: 'var(--mkt-bg-sunken)',
        borderBottom: '2px solid var(--mkt-border)',
      }}
    >
      <div className="flex gap-1.5">
        <span
          className="h-3 w-3"
          style={{
            background: 'var(--mkt-accent)',
            border: '1.5px solid var(--mkt-border)',
            borderRadius: '50% 45% 50% 45%',
          }}
        />
        <span
          className="h-3 w-3"
          style={{
            background: 'var(--mkt-postit-deep)',
            border: '1.5px solid var(--mkt-border)',
            borderRadius: '45% 50% 45% 50%',
          }}
        />
        <span
          className="h-3 w-3"
          style={{
            background: 'var(--mkt-secondary)',
            border: '1.5px solid var(--mkt-border)',
            borderRadius: '50% 50% 45% 50%',
          }}
        />
      </div>
      <div className="flex flex-1 justify-center">
        <div
          className="flex items-center gap-1.5 px-3 py-1"
          style={{
            background: 'var(--mkt-bg-elev)',
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.85rem',
            color: 'var(--mkt-fg-subtle)',
            border: '1.5px solid var(--mkt-border)',
            borderRadius: '14px 4px 12px 6px / 6px 14px 4px 12px',
          }}
        >
          <Lock size={12} strokeWidth={2.6} aria-hidden />
          <span>bayaan.app/{activeTab}</span>
        </div>
      </div>
      <span className="w-10" />
    </div>
  );
}

