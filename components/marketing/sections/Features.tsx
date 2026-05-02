'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Languages,
  HandCoins,
  Repeat,
  Globe2,
  Lock,
  Heart,
} from 'lucide-react';
import {
  SketchCard,
  StickyTag,
  OrganicBlob,
  PaperUnderline,
} from '@/components/marketing/sketch';

// Each tab represents a connection point bayaan creates between the mosque
// and its visitors — not a dashboard view. The order goes: language reach,
// one-off support, recurring members, audience growth.
const tabs = [
  { id: 'translation', icon: Languages },
  { id: 'donations', icon: HandCoins },
  { id: 'members', icon: Repeat },
  { id: 'reach', icon: Globe2 },
] as const;

const featureItems = [
  {
    key: 'translation',
    icon: Languages,
    tone: 'paper' as const,
    rotate: -1.5,
    decoration: 'tape' as const,
    span: 'lg:col-span-2',
  },
  {
    key: 'donations',
    icon: HandCoins,
    tone: 'postit' as const,
    rotate: 1.8,
    decoration: 'tack' as const,
    span: 'lg:col-span-1',
  },
  {
    key: 'members',
    icon: Heart,
    tone: 'paper' as const,
    rotate: -1,
    decoration: 'tack-blue' as const,
    span: 'lg:col-span-1',
  },
] as const;

const stats = [
  { key: 'transcription', variant: 1 },
  { key: 'translation', variant: 2 },
  { key: 'accuracy', variant: 3 },
  { key: 'latency', variant: 4 },
] as const;

export default function Features() {
  const t = useTranslations('marketing.features');
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('translation');

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

        {/* Polaroid dashboard preview — taped to the page */}
        <div
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
            {/* Browser chrome — sketched */}
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

            <DashboardSkeleton activeTab={activeTab} />
          </div>
        </div>

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

        {/* Stats — organic blobs, not the hero-metric template */}
        <div className="mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {stats.map((s, i) => (
            <OrganicBlob
              key={s.key}
              variant={s.variant}
              // Aspect ratio only forced on md+ where we have room for it.
              // On mobile the blob hugs its content (Kalam stat + label).
              className="flex-col text-center md:aspect-square"
              style={{
                padding: '1.25rem',
                transform: `rotate(${[-2, 1.5, -1, 2][i]}deg)`,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--mkt-font-display)',
                  fontWeight: 700,
                  color: 'var(--mkt-fg)',
                  fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
                  lineHeight: 1.05,
                }}
              >
                {t(`stats.${s.key}.value`)}
              </div>
              <div
                className="mt-2"
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  color: 'var(--mkt-fg-muted)',
                  fontSize: '0.95rem',
                  lineHeight: 1.3,
                }}
              >
                {t(`stats.${s.key}.label`)}
              </div>
            </OrganicBlob>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton({ activeTab }: { activeTab: string }) {
  return (
    <div
      key={activeTab}
      className="grid gap-4 p-5 md:grid-cols-[200px_1fr] md:p-7"
      style={{
        background: 'var(--mkt-bg-elev)',
        minHeight: 360,
      }}
    >
      {/* Sidebar */}
      <aside
        className="hidden flex-col gap-2 p-3 md:flex"
        style={{
          background: 'var(--mkt-bg-sunken)',
          border: '2px solid var(--mkt-border)',
          borderRadius: 'var(--mkt-wobbly-md)',
        }}
      >
        {[0.85, 0.55, 0.7, 0.45, 0.6, 0.5].map((w, i) => (
          <div
            key={i}
            className="h-3"
            style={{
              width: `${w * 100}%`,
              background:
                i === 0 ? 'var(--mkt-accent)' : 'var(--mkt-border-soft)',
              borderRadius: '8px 2px 8px 2px',
            }}
          />
        ))}
      </aside>

      {/* Main */}
      <div className="flex flex-col gap-4">
        {/* Stat row */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="p-4"
              style={{
                background: 'var(--mkt-bg)',
                border: '2px solid var(--mkt-border)',
                borderRadius: 'var(--mkt-wobbly-md)',
                boxShadow: '3px 3px 0 0 var(--mkt-border)',
                transform: `rotate(${[-1, 0.5, -0.5][i]}deg)`,
              }}
            >
              <div
                className="h-2.5"
                style={{
                  width: '40%',
                  background: 'var(--mkt-border-soft)',
                  borderRadius: 6,
                }}
              />
              <div
                className="mt-3 h-6"
                style={{
                  width: '60%',
                  background: i === 1 ? 'var(--mkt-postit)' : 'var(--mkt-accent-soft)',
                  border: '1.5px solid var(--mkt-border)',
                  borderRadius: '10px 3px 12px 4px',
                }}
              />
            </div>
          ))}
        </div>
        {/* Chart placeholder — bars with hand-drawn variance */}
        <div
          className="flex-1 p-4"
          style={{
            background: 'var(--mkt-bg)',
            border: '2px solid var(--mkt-border)',
            borderRadius: 'var(--mkt-wobbly-md)',
            minHeight: 180,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          {[0.4, 0.7, 0.55, 0.85, 0.65, 0.9, 0.75, 0.5, 0.95, 0.7, 0.6, 0.8].map(
            (h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100}%`,
                  background:
                    i % 3 === 0 ? 'var(--mkt-accent)' : 'var(--mkt-postit)',
                  border: '1.5px solid var(--mkt-border)',
                  borderRadius: '6px 3px 0 0',
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
