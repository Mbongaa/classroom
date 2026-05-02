'use client';

import * as React from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { setLocale } from '@/app/actions/locale';
import { isLocale, type Locale } from '@/i18n/config';
import { SketchLocaleToggle } from '@/components/marketing/shared/SketchLocaleToggle';

type Mode = 'signin' | 'signup';

interface AuthShellProps {
  mode: Mode;
  children: React.ReactNode;
  /** Live count of registered organizations, surfaced as social proof. */
  organizationCount?: number;
}

/**
 * Split-pane auth shell in the sketch design system.
 *
 * - Left: dark "minbar" panel with brand, BETA tag, headline, mock caption,
 *   social proof, decorative sticky.
 * - Right: paper card with tabs (sign in / create account) + the form
 *   children passed in.
 *
 * The shell wraps everything in `data-mkt-root` so the marketing CSS tokens
 * (--mkt-bg, --mkt-fg, --mkt-accent, etc.) and Kalam / Patrick Hand fonts
 * apply. Light-only — the underlying page sets `data-mkt-root` ⇒ sketch
 * palette regardless of global theme.
 */
export function AuthShell({ mode, children, organizationCount }: AuthShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Same body-scroll + paper-bg fix as the marketing landing — see
  // MarketingLandingPage for rationale (Android Chrome <105 lacks `:has()`
  // so we apply the unlock via a JS class instead).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mkt-active');
    return () => {
      root.classList.remove('mkt-active');
    };
  }, []);

  // Forward-locale handoff: when the user picked a language on bayaan.ai
  // (the marketing host) and got bounced here by middleware, the locale
  // arrives as `?locale=xx`. Persist it on the app-host cookie so subsequent
  // pages render in the picked language, then strip the param from the URL.
  useEffect(() => {
    const incoming = searchParams.get('locale');
    if (!incoming || !isLocale(incoming)) return;
    void setLocale(incoming);
    const url = new URL(window.location.href);
    url.searchParams.delete('locale');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  const t = useTranslations('marketing.auth.tabs');
  const tShell = useTranslations('marketing.auth.shell');

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    router.push(next === 'signup' ? '/signup' : '/login');
  };

  return (
    <div data-mkt-root className="auth-stage">
      {/* Back-to-landing button — fixed top-left, mirrors the locale toggle.
          Cream paper styling so it pops against the dark left pane on
          desktop and blends on the stacked mobile layout. */}
      <Link
        href="/"
        aria-label="Back to home"
        style={{
          position: 'fixed',
          top: 14,
          left: 14,
          zIndex: 70,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px 8px 12px',
          background: 'var(--mkt-bg-elev)',
          border: '2.5px solid var(--mkt-border)',
          borderRadius: 999,
          fontFamily: 'var(--mkt-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--mkt-fg)',
          textDecoration: 'none',
          boxShadow: '3px 3px 0 var(--mkt-border)',
          transform: 'rotate(-1deg)',
          lineHeight: 1,
        }}
      >
        <ArrowLeft size={16} strokeWidth={2.6} aria-hidden />
        <span>Back</span>
      </Link>

      {/* Locale picker — fixed top-right so it sits above both panes and
          stays reachable on the mobile stacked layout. */}
      <div
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 70,
        }}
      >
        <SketchLocaleToggle compact />
      </div>

      <LeftPane mode={mode} organizationCount={organizationCount} />

      <div className="auth-right">
        <div className="auth-right-inner">
          {/* Decorative sticky tucked bottom-right */}
          <div
            aria-hidden
            className="auth-decorative-sticky"
            style={{
              position: 'absolute',
              bottom: -10,
              right: -10,
              transform: 'rotate(6deg)',
              fontSize: 13,
              maxWidth: 170,
              zIndex: 1,
              background: 'var(--mkt-postit)',
              border: '2.5px solid var(--mkt-border)',
              padding: '10px 14px',
              fontFamily: 'var(--mkt-font-display)',
              color: 'var(--mkt-fg)',
              boxShadow: '4px 4px 0 var(--mkt-border)',
              borderRadius: '14px 28px 14px 28px / 28px 14px 28px 14px',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%) rotate(-3deg)',
                width: 60,
                height: 18,
                background: 'rgba(0,0,0,0.18)',
                border: '1px dashed rgba(0,0,0,0.3)',
              }}
            />
            {tShell('audioPrivate')}
          </div>

          <div className="auth-card">
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`}
                onClick={() => switchMode('signin')}
              >
                {t('signin')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                {t('signup')}
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Locale-aware translation of the mock-caption sample line so the auth
// page mirrors what the actual product would render in each language.
const MOCK_CAPTION_BY_LOCALE: Record<Locale, { tag: string; text: string }> = {
  en: { tag: 'EN', text: 'All praise is due to Allah, we praise Him' },
  nl: { tag: 'NL', text: 'Alle lof is voor Allah, wij prijzen Hem' },
  de: { tag: 'DE', text: 'Aller Lob gebührt Allah, wir preisen Ihn' },
  fr: { tag: 'FR', text: 'Toute louange est due à Allah, nous Le louons' },
  ar: { tag: 'AR', text: 'إنّ الحمدَ لله نحمدُهُ' },
};

function LeftPane({
  mode,
  organizationCount,
}: {
  mode: Mode;
  organizationCount?: number;
}) {
  const activeLocale = useLocale() as Locale;
  const mock = MOCK_CAPTION_BY_LOCALE[activeLocale] ?? MOCK_CAPTION_BY_LOCALE.en;
  const t = useTranslations('marketing.auth.shell');
  // Server-resolved count when available; otherwise show a quiet fallback so
  // the slot doesn't render empty during static generation / SSR-skip cases.
  const count = organizationCount ?? 7;
  // ICU-style pluralization isn't worth wiring for a single string here.
  const masjidCountLabel = t(count === 1 ? 'socialMasjid' : 'socialMasjids', { count });
  return (
    <div className="auth-left">
      <div className="auth-left-grain" aria-hidden />

      <div className="auth-left-head">
        <Link
          href="/"
          className="auth-logo"
          style={{ color: 'var(--mkt-bg-elev)' }}
        >
          <span>bayaan</span>
          <span style={{ color: 'var(--mkt-accent)' }}>.ai</span>
        </Link>
        <span
          aria-hidden
          className="auth-beta-chip"
          style={{
            fontSize: 13,
            padding: '4px 10px',
            background: 'rgba(255,249,196,0.15)',
            border: '1.5px dashed rgba(255,249,196,0.5)',
            color: 'var(--mkt-postit)',
            fontFamily: 'var(--mkt-font-display)',
            transform: 'rotate(2deg)',
          }}
        >
          {t('beta')}
        </span>
      </div>

      <div className="auth-left-body">
        <h1 className="auth-left-headline">
          {t('headlineLine1')}
          <br />
          {t('headlineLine2Pre')}{' '}
          <span className="auth-marker-yellow">{t('headlineLine2Marker')}</span>
          .
        </h1>
        <p className="auth-left-lead">
          {t('leadBase')}{' '}
          {mode === 'signup' ? t('leadSignup') : t('leadSignin')}
        </p>

        {/* Mock translation caption */}
        <div className="auth-mock-caption">
          <span className="auth-mock-tag">{t('mockSpeaker')}</span>
          <div
            lang="ar"
            dir="rtl"
            style={{
              fontSize: 19,
              lineHeight: 1.4,
              marginBottom: 4,
              fontFamily: "'Noto Sans Arabic', system-ui, serif",
            }}
          >
            إنّ الحمدَ لله نحمدُهُ
          </div>
          <span
            className="auth-mock-tag"
            style={{ background: 'var(--mkt-postit-blue)' }}
          >
            {mock.tag}
          </span>
          <div
            style={{ fontSize: 16 }}
            dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}
            lang={activeLocale}
          >
            {t('mockText')}
            <span className="auth-cursor">▌</span>
          </div>
        </div>
      </div>

      <div className="auth-left-foot">
        <div className="auth-avatars" aria-hidden>
          {['A', 'M', 'Y', 'S', '+'].map((l, i) => (
            <span
              key={l}
              style={{
                background: [
                  'var(--mkt-postit)',
                  'var(--mkt-postit-blue)',
                  'var(--mkt-postit-green)',
                  'var(--mkt-postit-pink)',
                  'var(--mkt-bg)',
                ][i],
              }}
            >
              {l}
            </span>
          ))}
        </div>
        <div>
          <div>
            <strong style={{ color: 'var(--mkt-bg-elev)' }}>
              {masjidCountLabel}
            </strong>{' '}
            {t('socialAlready')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            {t('countries')}
          </div>
        </div>
      </div>

      {/* Decorative testimonial sticky */}
      <div
        aria-hidden
        className="auth-decorative-sticky"
        style={{
          position: 'absolute',
          bottom: 80,
          right: -10,
          transform: 'rotate(6deg)',
          fontSize: 14,
          maxWidth: 170,
          background: 'var(--mkt-postit-green)',
          border: '2.5px solid var(--mkt-border)',
          padding: '10px 14px',
          fontFamily: 'var(--mkt-font-display)',
          color: 'var(--mkt-fg)',
          boxShadow: '4px 4px 0 var(--mkt-border)',
          zIndex: 3,
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%) rotate(-3deg)',
            width: 60,
            height: 18,
            background: 'rgba(0,0,0,0.18)',
            border: '1px dashed rgba(0,0,0,0.3)',
          }}
        />
        ✨ {t('testimonial')} <em>· {t('testimonialAttribution')}</em>
      </div>
    </div>
  );
}
