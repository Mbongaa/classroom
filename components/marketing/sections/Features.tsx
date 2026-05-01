'use client';

import { useTranslations } from 'next-intl';
import { Globe2, Sparkles, FileAudio, Shield, Users2 } from 'lucide-react';

export default function Features() {
  const t = useTranslations('marketing.features');

  return (
    <section
      id="features"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="max-w-2xl">
          <span className="mkt-eyebrow">{t('eyebrow')}</span>
          <h2 className="mkt-h2 mt-3">{t('title')}</h2>
          <p className="mkt-lead mt-4">{t('lead')}</p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-6">
          {/* Big feature: spans 2 columns, 2 rows on desktop */}
          <article
            className="mkt-card flex flex-col lg:col-span-2 lg:row-span-2"
            style={{ minHeight: 360 }}
          >
            <div
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }}
            >
              <Globe2 size={22} aria-hidden />
            </div>
            <h3 className="mkt-h3">{t('items.languages.title')}</h3>
            <p
              className="mt-2 leading-relaxed"
              style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.98rem' }}
            >
              {t('items.languages.body')}
            </p>

            <LanguageStrip />
          </article>

          {/* Three smaller features */}
          <SmallFeatureCard
            icon={Sparkles}
            title={t('items.realtime.title')}
            body={t('items.realtime.body')}
          />
          <SmallFeatureCard
            icon={FileAudio}
            title={t('items.recordings.title')}
            body={t('items.recordings.body')}
          />

          {/* Two more smaller features in row 2 (col 3 + something extra) */}
          <SmallFeatureCard
            icon={Users2}
            title={t('items.classroom.title')}
            body={t('items.classroom.body')}
            className="lg:col-start-1"
          />
          <SmallFeatureCard
            icon={Shield}
            title={t('items.privacy.title')}
            body={t('items.privacy.body')}
            className="lg:col-start-2"
          />
          <PublicDisplayCard />
        </div>
      </div>
    </section>
  );
}

interface SmallFeatureCardProps {
  icon: typeof Sparkles;
  title: string;
  body: string;
  className?: string;
}

function SmallFeatureCard({ icon: Icon, title, body, className = '' }: SmallFeatureCardProps) {
  return (
    <article className={`mkt-card flex flex-col ${className}`}>
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }}
      >
        <Icon size={20} aria-hidden />
      </div>
      <h3 className="mkt-h3" style={{ fontSize: '1.125rem' }}>
        {title}
      </h3>
      <p
        className="mt-2 leading-relaxed"
        style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.92rem' }}
      >
        {body}
      </p>
    </article>
  );
}

function LanguageStrip() {
  const langs = [
    { code: 'en', label: 'English', sample: 'Be just; that is nearer to piety.' },
    { code: 'nl', label: 'Nederlands', sample: 'Wees rechtvaardig, dat is dichter bij godsvrucht.' },
    { code: 'fr', label: 'Français', sample: 'Soyez justes, cela est plus proche de la piété.' },
    { code: 'de', label: 'Deutsch', sample: 'Seid gerecht, das ist näher zur Gottesfurcht.' },
  ];
  return (
    <div className="mt-auto pt-8">
      <ul className="space-y-2">
        {langs.map((l, i) => (
          <li
            key={l.code}
            className="flex items-center gap-3 rounded-lg p-3"
            style={{
              background: 'var(--mkt-bg)',
              border: '1px solid var(--mkt-border)',
              opacity: 1 - i * 0.12,
            }}
          >
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--mkt-brand-soft)', color: 'var(--mkt-brand-deep)' }}
            >
              {l.code}
            </span>
            <span
              className="truncate text-[13.5px]"
              style={{ color: 'var(--mkt-fg)' }}
            >
              {l.sample}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublicDisplayCard() {
  const t = useTranslations('marketing.features');
  return (
    <article
      className="mkt-card relative flex flex-col overflow-hidden"
      style={{ background: 'var(--mkt-preview-bg)', borderColor: 'var(--mkt-preview-border)' }}
    >
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'oklch(0.30 0.07 165)', color: 'var(--mkt-preview-brand)' }}
      >
        <Sparkles size={20} aria-hidden />
      </div>
      <h3 className="mkt-h3" style={{ fontSize: '1.125rem', color: 'var(--mkt-preview-fg)' }}>
        {t('items.publicDisplay.title')}
      </h3>
      <p
        className="mt-2 leading-relaxed"
        style={{ color: 'var(--mkt-preview-fg-muted)', fontSize: '0.92rem' }}
      >
        {t('items.publicDisplay.body')}
      </p>
    </article>
  );
}
