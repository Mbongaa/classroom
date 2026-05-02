'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Radio,
  BarChart3,
  Lock,
  CreditCard,
  Landmark,
  Repeat,
  HandCoins,
} from 'lucide-react';

const tabs = [
  { id: 'overview', icon: BarChart3 },
  { id: 'rooms', icon: Radio },
  { id: 'donations', icon: HandCoins },
  { id: 'mandates', icon: Repeat },
] as const;

const featureItems = [
  { key: 'payments', icon: CreditCard },
  { key: 'sepa', icon: Landmark },
  { key: 'batches', icon: Repeat },
] as const;

const stats = [
  { key: 'transcription' },
  { key: 'translation' },
  { key: 'accuracy' },
  { key: 'latency' },
] as const;

export default function Features() {
  const t = useTranslations('marketing.features');
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('overview');

  return (
    <section
      id="features"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mkt-h2">{t('title')}</h2>
          <p className="mkt-lead mt-4 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        {/* Dashboard tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="mkt-focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
                style={{
                  background: active ? 'var(--mkt-brand)' : 'var(--mkt-bg-elev)',
                  color: active ? 'oklch(0.99 0.005 165)' : 'var(--mkt-fg)',
                  border: '1px solid',
                  borderColor: active ? 'var(--mkt-brand)' : 'var(--mkt-border)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                }}
              >
                <Icon size={14} aria-hidden />
                <span>{t(`tabs.${tab.id}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Browser-chrome dashboard preview */}
        <div
          className="mx-auto mt-7 overflow-hidden rounded-2xl"
          style={{
            background: 'var(--mkt-bg-elev)',
            border: '1px solid var(--mkt-border)',
            boxShadow:
              '0 1px 1px oklch(0.20 0.02 200 / 0.04), 0 12px 32px oklch(0.20 0.02 200 / 0.10), 0 40px 100px oklch(0.20 0.02 200 / 0.18)',
            maxWidth: '1080px',
          }}
        >
          {/* Mac-window chrome */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{
              background: 'var(--mkt-bg-sunken)',
              borderBottom: '1px solid var(--mkt-border)',
            }}
          >
            <div className="flex gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'oklch(0.72 0.16 25)' }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'oklch(0.82 0.13 80)' }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'oklch(0.70 0.13 155)' }}
              />
            </div>
            <div className="flex flex-1 justify-center">
              <div
                className="flex items-center gap-1.5 rounded-md px-3 py-1"
                style={{
                  background: 'var(--mkt-bg)',
                  fontSize: '11px',
                  color: 'var(--mkt-fg-subtle)',
                  border: '1px solid var(--mkt-border)',
                }}
              >
                <Lock size={10} aria-hidden />
                <span>dashboard.bayaan.ai/{activeTab}</span>
              </div>
            </div>
            <span className="w-10" /> {/* Spacer for symmetry */}
          </div>

          {/* Faux dashboard content (lightweight skeleton — not a real screenshot) */}
          <DashboardSkeleton activeTab={activeTab} />
        </div>

        {/* Feature cards — uniform 3-col grid */}
        <div className="mt-16 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.key} className="mkt-card flex flex-col">
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <Icon size={20} aria-hidden />
                </div>
                <h3 className="mkt-h3" style={{ fontSize: '1.05rem' }}>
                  {t(`items.${item.key}.title`)}
                </h3>
                <p
                  className="mt-2 leading-relaxed"
                  style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.92rem' }}
                >
                  {t(`items.${item.key}.body`)}
                </p>
              </article>
            );
          })}
        </div>

        {/* Stats strip — drenched emerald block */}
        <div
          className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 rounded-2xl px-6 py-10 sm:grid-cols-4 md:px-12 md:py-14"
          style={{
            background:
              'linear-gradient(135deg, var(--mkt-brand-deep), var(--mkt-brand))',
            color: 'oklch(0.96 0.02 165)',
          }}
        >
          {stats.map((s) => (
            <div key={s.key} className="text-center">
              <div
                className="font-bold tabular-nums"
                style={{
                  color: 'oklch(0.99 0.005 165)',
                  fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                  letterSpacing: '-0.025em',
                  lineHeight: 1,
                }}
              >
                {t(`stats.${s.key}.value`)}
              </div>
              <div
                className="mt-3"
                style={{
                  color: 'oklch(0.92 0.04 165)',
                  fontSize: '0.85rem',
                  letterSpacing: '-0.005em',
                }}
              >
                {t(`stats.${s.key}.label`)}
              </div>
            </div>
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
        background:
          'linear-gradient(180deg, var(--mkt-bg-elev) 0%, var(--mkt-bg) 100%)',
        minHeight: 360,
      }}
    >
      {/* Sidebar */}
      <aside
        className="hidden flex-col gap-2 rounded-xl p-3 md:flex"
        style={{
          background: 'var(--mkt-bg)',
          border: '1px solid var(--mkt-border)',
        }}
      >
        {[0.85, 0.55, 0.7, 0.45, 0.6, 0.5].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded"
            style={{
              width: `${w * 100}%`,
              background:
                i === 0
                  ? 'var(--mkt-brand-soft)'
                  : 'var(--mkt-border)',
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
              className="rounded-xl p-4"
              style={{
                background: 'var(--mkt-bg)',
                border: '1px solid var(--mkt-border)',
              }}
            >
              <div
                className="h-2.5 rounded"
                style={{ width: '40%', background: 'var(--mkt-border)' }}
              />
              <div
                className="mt-3 h-6 rounded"
                style={{
                  width: '60%',
                  background: 'var(--mkt-brand-soft)',
                }}
              />
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <div
          className="flex-1 rounded-xl p-4"
          style={{
            background: 'var(--mkt-bg)',
            border: '1px solid var(--mkt-border)',
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
                    i % 3 === 0
                      ? 'var(--mkt-brand)'
                      : 'var(--mkt-brand-soft)',
                  borderRadius: '4px 4px 0 0',
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
