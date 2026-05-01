'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, Share2, Languages } from 'lucide-react';

const steps = [
  { key: 'create', icon: CalendarPlus },
  { key: 'share', icon: Share2 },
  { key: 'translate', icon: Languages },
];

export default function HowItWorksMobile() {
  const t = useTranslations('marketing.howItWorks');

  return (
    <section id="how-it-works" className="mkt-section" style={{ paddingBlock: '3.5rem' }}>
      <div className="mkt-container">
        <span className="mkt-eyebrow">{t('eyebrow')}</span>
        <h2 className="mkt-h2 mt-2" style={{ fontSize: 'clamp(1.625rem, 7vw, 2rem)' }}>
          {t('title')}
        </h2>
        <p className="mkt-lead mt-3" style={{ fontSize: '1rem' }}>
          {t('lead')}
        </p>

        <ol className="mt-9 space-y-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className="relative grid grid-cols-[auto_1fr] gap-4"
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <Icon size={20} aria-hidden />
                </div>

                <div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-semibold tabular-nums"
                      style={{
                        color: 'var(--mkt-fg-subtle)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mkt-h3" style={{ fontSize: '1.125rem' }}>
                      {t(`steps.${step.key}.title`)}
                    </h3>
                  </div>
                  <p
                    className="mt-1.5 leading-relaxed"
                    style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.92rem' }}
                  >
                    {t(`steps.${step.key}.body`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
