'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function MarketingFooter() {
  const t = useTranslations('marketing.footer');
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative mt-24"
      style={{
        background: 'var(--mkt-bg-sunken)',
        color: 'var(--mkt-fg-muted)',
      }}
    >
      {/* Wavy top divider — paper torn at the seam */}
      <svg
        aria-hidden
        className="absolute -top-px left-0 right-0 w-full"
        height="24"
        viewBox="0 0 1200 24"
        preserveAspectRatio="none"
        style={{ transform: 'translateY(-99%)' }}
      >
        <path
          d="M 0 24 Q 100 4 220 14 T 480 12 T 720 16 T 960 8 T 1200 18 L 1200 24 L 0 24 Z"
          fill="var(--mkt-bg-sunken)"
        />
      </svg>

      <div className="mkt-container py-20">
        <div className="max-w-2xl">
          {/* Brand block */}
          <div>
            <Link
              href="/"
              className="mkt-focus-ring inline-flex items-baseline"
              style={{
                fontFamily: 'var(--mkt-font-display)',
                color: 'var(--mkt-fg)',
                fontSize: '2rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              <span>bayaan</span>
              <span style={{ color: 'var(--mkt-accent)' }}>.ai</span>
            </Link>
            <p
              className="mt-5 max-w-sm"
              style={{
                fontFamily: 'var(--mkt-font-body)',
                color: 'var(--mkt-fg-muted)',
                fontSize: '1.05rem',
                lineHeight: 1.6,
              }}
            >
              {t('tagline')}
            </p>

            <ul className="mt-7 space-y-3">
              <li className="flex items-center gap-2.5">
                <Mail
                  size={16}
                  strokeWidth={2.6}
                  aria-hidden
                  style={{ color: 'var(--mkt-accent)' }}
                />
                <a
                  href={`mailto:${t('contact.email')}`}
                  className="mkt-focus-ring mkt-link"
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    fontSize: '1rem',
                  }}
                >
                  {t('contact.email')}
                </a>
              </li>
              <li
                className="flex items-center gap-2.5"
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  fontSize: '1rem',
                  color: 'var(--mkt-fg-muted)',
                }}
              >
                <Phone
                  size={16}
                  strokeWidth={2.6}
                  aria-hidden
                  style={{ color: 'var(--mkt-accent)' }}
                />
                <span>{t('contact.phone')}</span>
              </li>
              <li
                className="flex items-center gap-2.5"
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  fontSize: '1rem',
                  color: 'var(--mkt-fg-muted)',
                }}
              >
                <MapPin
                  size={16}
                  strokeWidth={2.6}
                  aria-hidden
                  style={{ color: 'var(--mkt-accent)' }}
                />
                <span>{t('contact.city')}</span>
              </li>
            </ul>
          </div>

        </div>

        <div
          className="mt-16 flex flex-col items-start justify-between gap-3 pt-6 md:flex-row md:items-center"
          style={{
            borderTop: '2px dashed var(--mkt-border)',
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.95rem',
            color: 'var(--mkt-fg-muted)',
          }}
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
