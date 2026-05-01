'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, Share2, Languages } from 'lucide-react';

const steps = [
  { key: 'create', icon: CalendarPlus },
  { key: 'share', icon: Share2 },
  { key: 'translate', icon: Languages },
];

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

        <ol className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.key} className="relative flex flex-col">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <Icon size={26} aria-hidden />
                </div>

                <div className="mt-6 flex items-baseline gap-3">
                  <span
                    className="font-semibold tabular-nums"
                    style={{
                      color: 'var(--mkt-fg-subtle)',
                      fontSize: '0.95rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mkt-h3">{t(`steps.${step.key}.title`)}</h3>
                </div>

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
