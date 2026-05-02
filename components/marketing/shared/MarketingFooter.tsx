'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

const linkGroups = [
  {
    titleKey: 'product',
    links: [
      { href: '#features', key: 'features' },
      { href: '#contact', key: 'contact' },
      { href: 'mailto:support@bayaan.ai?subject=Demo%20request', key: 'demo' },
      { href: 'mailto:support@bayaan.ai?subject=API%20access', key: 'api' },
    ],
  },
  {
    titleKey: 'mosques',
    links: [
      { href: '#use-cases', key: 'useCases' },
      { href: '#testimonials', key: 'stories' },
      { href: 'mailto:support@bayaan.ai?subject=Resources', key: 'resources' },
      { href: 'mailto:support@bayaan.ai?subject=Support', key: 'support' },
    ],
  },
  {
    titleKey: 'company',
    links: [
      { href: '#story', key: 'about' },
      { href: 'mailto:support@bayaan.ai?subject=Careers', key: 'careers' },
      { href: '#contact', key: 'contact' },
    ],
  },
  {
    titleKey: 'legal',
    links: [
      { href: '/legal/privacy', key: 'privacy' },
      { href: '/legal/terms', key: 'terms' },
      { href: '/legal/security', key: 'security' },
      { href: '/legal/compliance', key: 'compliance' },
    ],
  },
] as const;

export function MarketingFooter() {
  const t = useTranslations('marketing.footer');
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-24 border-t"
      style={{
        background: 'var(--mkt-bg-sunken)',
        borderColor: 'var(--mkt-border)',
        color: 'var(--mkt-fg-muted)',
      }}
    >
      <div className="mkt-container py-16">
        {/* Top row: brand + tagline + contact, then 4 link columns */}
        <div className="grid gap-12 md:grid-cols-[minmax(0,_1.4fr)_minmax(0,_2fr)] md:gap-14">
          {/* Brand block */}
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-xl font-bold"
                style={{
                  background: 'var(--mkt-brand)',
                  color: 'oklch(0.99 0.005 165)',
                  fontSize: '1.125rem',
                  letterSpacing: '-0.02em',
                }}
              >
                B
              </span>
              <span
                className="font-bold tracking-tight"
                style={{
                  color: 'var(--mkt-fg)',
                  fontSize: '1.5rem',
                  letterSpacing: '-0.03em',
                }}
              >
                bayaan
              </span>
            </div>
            <p
              className="mt-5 max-w-sm leading-relaxed"
              style={{
                color: 'var(--mkt-fg-muted)',
                fontSize: '0.92rem',
              }}
            >
              {t('tagline')}
            </p>

            {/* Contact strip */}
            <ul className="mt-7 space-y-3">
              <li className="flex items-center gap-2.5 text-[14px]">
                <Mail
                  size={14}
                  aria-hidden
                  style={{ color: 'var(--mkt-brand)' }}
                />
                <a
                  href={`mailto:${t('contact.email')}`}
                  className="mkt-focus-ring transition-colors"
                  style={{ color: 'var(--mkt-fg)' }}
                >
                  {t('contact.email')}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-[14px]">
                <Phone
                  size={14}
                  aria-hidden
                  style={{ color: 'var(--mkt-brand)' }}
                />
                <span style={{ color: 'var(--mkt-fg-muted)' }}>
                  {t('contact.phone')}
                </span>
              </li>
              <li className="flex items-center gap-2.5 text-[14px]">
                <MapPin
                  size={14}
                  aria-hidden
                  style={{ color: 'var(--mkt-brand)' }}
                />
                <span style={{ color: 'var(--mkt-fg-muted)' }}>
                  {t('contact.city')}
                </span>
              </li>
            </ul>
          </div>

          {/* 4 link columns */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {linkGroups.map((group) => (
              <div key={group.titleKey}>
                <h3
                  className="text-[11px] font-bold uppercase"
                  style={{
                    color: 'var(--mkt-fg)',
                    letterSpacing: '0.18em',
                  }}
                >
                  {t(`groups.${group.titleKey}`)}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={link.href}
                        className="mkt-focus-ring text-[14px] transition-colors hover:underline"
                        style={{ color: 'var(--mkt-fg-muted)' }}
                      >
                        {t(`links.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-14 flex flex-col items-start justify-between gap-3 border-t pt-6 text-[13px] md:flex-row md:items-center"
          style={{ borderColor: 'var(--mkt-border)' }}
        >
          <p>
            © {year} bayaan. {t('copyright')}
          </p>
          <p style={{ color: 'var(--mkt-fg-subtle)' }}>{t('madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
