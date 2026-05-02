'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { completeOnboarding } from '@/lib/actions/auth';
import { slugify } from '@/lib/slugify';

interface WelcomeFormProps {
  initialFullName: string;
  email: string;
}

/**
 * Onboarding form shown to OAuth-signed-up users on /welcome.
 *
 * The visual styling reuses the sketch auth tokens (`auth-card`,
 * `auth-field-*`, `auth-btn`) so it sits inside the same design system as
 * /login and /signup, just without the split-pane shell or the mode tabs.
 */
export function WelcomeForm({ initialFullName, email }: WelcomeFormProps) {
  const t = useTranslations('marketing.auth.welcome');
  const tSignup = useTranslations('marketing.auth.signup');

  const [fullName, setFullName] = useState(initialFullName);
  const [org, setOrg] = useState('');
  const [touched, setTouched] = useState<{ org?: boolean; fullName?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [bannerErr, setBannerErr] = useState('');

  // Match the AuthShell behaviour so the marketing CSS tokens / paper bg
  // apply on this page too.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mkt-active');
    return () => {
      root.classList.remove('mkt-active');
    };
  }, []);

  const slug = useMemo(() => slugify(org), [org]);

  const errs = {
    fullName: touched.fullName && !fullName.trim() ? t('name.required') : '',
    org: touched.org && !org.trim() ? t('org.required') : '',
  };
  const valid = fullName.trim() && org.trim();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ fullName: true, org: true });
    if (!valid) return;
    setBannerErr('');
    setSubmitting(true);

    const fd = new FormData();
    fd.set('fullName', fullName.trim());
    fd.set('orgName', org.trim());

    try {
      const result = await completeOnboarding(fd);
      if (!result.success && result.error) {
        setBannerErr(result.error);
        setSubmitting(false);
        return;
      }
      window.location.href = result.redirectUrl ?? '/dashboard';
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      setBannerErr(t('errorGeneric'));
      setSubmitting(false);
    }
  }

  return (
    <div data-mkt-root className="auth-stage" style={{ gridTemplateColumns: '1fr' }}>
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

      <div className="auth-right">
        <div className="auth-right-inner">
          <div className="auth-card">
            <form onSubmit={handleSubmit} noValidate>
              <h2
                style={{
                  fontFamily: 'var(--mkt-font-display)',
                  fontSize: 30,
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                {t('titlePre')}{' '}
                <span
                  style={{
                    background:
                      'linear-gradient(180deg, transparent 55%, rgba(255,225,80,0.7) 55%, rgba(255,225,80,0.7) 92%, transparent 92%)',
                    padding: '0 4px',
                  }}
                >
                  {t('titleMarker')}
                </span>
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: 'rgba(45,45,45,0.65)',
                  marginBottom: 6,
                  marginTop: 0,
                  fontFamily: 'var(--mkt-font-body)',
                }}
              >
                {t('subtitle')}
              </p>
              {email && (
                <p
                  style={{
                    fontSize: 14,
                    color: 'rgba(45,45,45,0.55)',
                    marginBottom: 18,
                    marginTop: 0,
                    fontFamily: 'var(--mkt-font-body)',
                  }}
                >
                  {t('signedInAs', { email })}
                </p>
              )}

              {bannerErr && (
                <div className="auth-banner" role="alert">
                  <span style={{ fontSize: 18 }} aria-hidden>
                    ⚠️
                  </span>
                  <div>{bannerErr}</div>
                </div>
              )}

              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="welcome-name">
                  {t('name.label')} <span className="req">*</span>
                </label>
                <input
                  id="welcome-name"
                  type="text"
                  className={`auth-field ${errs.fullName ? 'is-error' : ''}`}
                  placeholder={t('name.placeholder')}
                  autoComplete="name"
                  autoCapitalize="words"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setTouched((tt) => ({ ...tt, fullName: true }))}
                  required
                />
                {errs.fullName && <div className="auth-field-error">↳ {errs.fullName}</div>}
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="welcome-org">
                  {t('org.label')} <span className="req">*</span>
                </label>
                <input
                  id="welcome-org"
                  type="text"
                  className={`auth-field ${errs.org ? 'is-error' : ''}`}
                  placeholder={t('org.placeholder')}
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  onBlur={() => setTouched((tt) => ({ ...tt, org: true }))}
                  required
                />
                {errs.org ? (
                  <div className="auth-field-error">↳ {errs.org}</div>
                ) : (
                  <div className="auth-field-helper">{t('org.hint')}</div>
                )}
                <div className="auth-url-preview" aria-live="polite">
                  <span style={{ fontSize: 14 }} aria-hidden>
                    🌐
                  </span>
                  <span className="domain">bayaan.app/</span>
                  {slug ? (
                    <span className="slug">{slug}</span>
                  ) : (
                    <span className="empty">{tSignup('urlEmpty')}</span>
                  )}
                </div>
              </div>

              <button type="submit" className="auth-btn" disabled={!valid || submitting}>
                {submitting ? (
                  <>
                    <span className="auth-spinner" /> {t('submitting')}
                  </>
                ) : (
                  t('submit')
                )}
              </button>

              <div className="auth-submit-helper">
                <span className="marker">{t('helperBeta')}</span>. {t('helperSetup')}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
