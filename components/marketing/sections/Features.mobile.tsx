'use client';

import { useTranslations } from 'next-intl';
import { Globe2, Sparkles, FileAudio, Shield, Users2 } from 'lucide-react';

const items = [
  { key: 'languages', icon: Globe2 },
  { key: 'realtime', icon: Sparkles },
  { key: 'classroom', icon: Users2 },
  { key: 'recordings', icon: FileAudio },
  { key: 'privacy', icon: Shield },
  { key: 'publicDisplay', icon: Sparkles },
] as const;

export default function FeaturesMobile() {
  const t = useTranslations('marketing.features');

  return (
    <section
      id="features"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)', paddingBlock: '3.5rem' }}
    >
      <div className="mkt-container">
        <span className="mkt-eyebrow">{t('eyebrow')}</span>
        <h2 className="mkt-h2 mt-2" style={{ fontSize: 'clamp(1.625rem, 7vw, 2rem)' }}>
          {t('title')}
        </h2>
        <p className="mkt-lead mt-3" style={{ fontSize: '1rem' }}>
          {t('lead')}
        </p>

        <ul className="mt-9 space-y-5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="mkt-card flex flex-col">
                <div
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }}
                >
                  <Icon size={20} aria-hidden />
                </div>
                <h3 className="mkt-h3" style={{ fontSize: '1.125rem' }}>
                  {t(`items.${item.key}.title`)}
                </h3>
                <p
                  className="mt-2 leading-relaxed"
                  style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.92rem' }}
                >
                  {t(`items.${item.key}.body`)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
