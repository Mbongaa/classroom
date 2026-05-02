'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Plus, Radio, Monitor } from 'lucide-react';

const steps = [
  { key: 'account', icon: UserPlus },
  { key: 'room', icon: Plus },
  { key: 'golive', icon: Radio },
  { key: 'display', icon: Monitor },
] as const;

export default function HowItWorks() {
  const t = useTranslations('marketing.howItWorks');

  return (
    <section id="how-it-works" className="mkt-section">
      <div className="mkt-container">
        <div className="max-w-2xl">
          <span className="mkt-eyebrow">{t('eyebrow')}</span>
          <h2 className="mkt-h2 mt-3">{t('title')}</h2>
          <p className="mkt-lead mt-4">{t('lead')}</p>
        </div>

        <ol
          className="relative mt-16 grid gap-x-10 gap-y-14 md:grid-cols-2 md:gap-y-20 lg:grid-cols-4"
          aria-label="Setup steps"
        >
          {/* Connecting timeline rail (desktop only, behind step circles) */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px lg:block"
            style={{
              background:
                'linear-gradient(to right, transparent 0, var(--mkt-border-strong) 8%, var(--mkt-border-strong) 92%, transparent 100%)',
            }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.key} className="relative flex flex-col">
                {/* Step number badge — sits ON the rail */}
                <div className="relative flex items-center gap-3">
                  <div
                    className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: 'var(--mkt-bg)',
                      border: '1px solid var(--mkt-border-strong)',
                      boxShadow: '0 2px 8px oklch(0.20 0.02 200 / 0.06)',
                    }}
                  >
                    <Icon
                      size={22}
                      aria-hidden
                      style={{ color: 'var(--mkt-brand)' }}
                    />
                  </div>
                  <span
                    className="font-semibold tabular-nums"
                    style={{
                      color: 'var(--mkt-fg-subtle)',
                      fontSize: '0.78rem',
                      letterSpacing: '0.18em',
                    }}
                  >
                    {t(`steps.${step.key}.label`)} {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="mkt-h3 mt-5">{t(`steps.${step.key}.title`)}</h3>
                <p
                  className="mt-3 leading-relaxed"
                  style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.98rem' }}
                >
                  {t(`steps.${step.key}.body`)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
