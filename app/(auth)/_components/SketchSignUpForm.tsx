'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signUp } from '@/lib/actions/auth';
import { slugify } from '@/lib/slugify';
import { createClient } from '@/lib/supabase/client';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function SketchSignUpForm() {
  const t = useTranslations('marketing.auth.signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [org, setOrg] = useState('');
  const [touched, setTouched] = useState<{
    name?: boolean;
    email?: boolean;
    password?: boolean;
    org?: boolean;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [bannerErr, setBannerErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  async function handleGoogleSignUp() {
    setBannerErr('');
    setGoogleSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBannerErr(error.message);
      setGoogleSubmitting(false);
    }
  }

  const slug = useMemo(() => slugify(org), [org]);

  const errs = {
    name: touched.name && !name ? t('name.required') : '',
    email:
      touched.email && email && !isEmail(email)
        ? t('email.invalid')
        : touched.email && !email
          ? t('email.required')
          : '',
    password:
      touched.password && password && password.length < 8
        ? t('password.tooShort')
        : touched.password && !password
          ? t('password.required')
          : '',
    org: touched.org && !org ? t('org.required') : '',
  };
  const valid = name && isEmail(email) && password.length >= 8 && org;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, org: true });
    if (!valid) return;
    setBannerErr('');
    setSubmitting(true);

    const fd = new FormData();
    fd.set('fullName', name);
    fd.set('email', email);
    fd.set('password', password);
    fd.set('orgName', org);
    fd.set('orgSlug', slug);
    // Plan defaults to 'beta' on the server when omitted.

    try {
      const result = await signUp(fd);
      if (!result.success && result.error) {
        setBannerErr(result.error);
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      // Hold the redirect URL so we can navigate after the success state
      // animation has been seen briefly.
      const dest = result.redirectUrl ?? result.checkoutUrl ?? '/dashboard';
      setRedirectUrl(dest);
      setTimeout(() => {
        window.location.href = dest;
      }, 1400);
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      setBannerErr(t('errorGeneric'));
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div className="auth-check" aria-hidden>
          ✓
        </div>
        <h3
          style={{
            fontFamily: 'var(--mkt-font-display)',
            fontSize: 26,
            marginBottom: 6,
            margin: 0,
          }}
        >
          <span
            style={{
              background:
                'linear-gradient(180deg, transparent 55%, rgba(255,225,80,0.7) 55%, rgba(255,225,80,0.7) 92%, transparent 92%)',
              padding: '0 4px',
            }}
          >
            {t('success.title')}
          </span>
        </h3>
        <p style={{ fontSize: 17, marginBottom: 4, fontFamily: 'var(--mkt-font-body)' }}>
          {t('success.ready', { url: `bayaan.app/${slug}` })}
        </p>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(45,45,45,0.6)',
            marginBottom: 18,
            fontFamily: 'var(--mkt-font-body)',
          }}
        >
          {redirectUrl ? t('success.redirecting') : t('success.redirectingDashboard')}
        </p>
        <span
          className="auth-spinner"
          style={{ borderColor: 'var(--mkt-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
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
              'linear-gradient(180deg, transparent 55%, rgba(255,77,77,0.35) 55%, rgba(255,77,77,0.35) 92%, transparent 92%)',
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
          marginBottom: 18,
          marginTop: 0,
          fontFamily: 'var(--mkt-font-body)',
        }}
      >
        {t('subtitle')}
      </p>

      {bannerErr && (
        <div className="auth-banner" role="alert">
          <span style={{ fontSize: 18 }} aria-hidden>
            ⚠️
          </span>
          <div>{bannerErr}</div>
        </div>
      )}

      <button
        type="button"
        className="auth-btn auth-btn-ghost"
        onClick={handleGoogleSignUp}
        disabled={googleSubmitting || submitting}
      >
        {googleSubmitting ? (
          <>
            <span className="auth-spinner" /> {t('submitting')}
          </>
        ) : (
          <>
            <GoogleIcon /> {t('googleButton')}
          </>
        )}
      </button>

      <div className="auth-or">{t('or')}</div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-name">
          {t('name.label')} <span className="req">*</span>
        </label>
        <input
          id="signup-name"
          type="text"
          className={`auth-field ${errs.name ? 'is-error' : ''}`}
          placeholder={t('name.placeholder')}
          autoComplete="name"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((tt) => ({ ...tt, name: true }))}
          required
        />
        {errs.name && <div className="auth-field-error">↳ {errs.name}</div>}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-email">
          {t('email.label')} <span className="req">*</span>
        </label>
        <input
          id="signup-email"
          type="email"
          className={`auth-field ${errs.email ? 'is-error' : ''}`}
          placeholder={t('email.placeholder')}
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((tt) => ({ ...tt, email: true }))}
          required
        />
        {errs.email && <div className="auth-field-error">↳ {errs.email}</div>}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-password">
          {t('password.label')} <span className="req">*</span>
        </label>
        <input
          id="signup-password"
          type="password"
          className={`auth-field ${errs.password ? 'is-error' : ''}`}
          placeholder={t('password.placeholder')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((tt) => ({ ...tt, password: true }))}
          required
          minLength={8}
        />
        {errs.password ? (
          <div className="auth-field-error">↳ {errs.password}</div>
        ) : (
          <div className="auth-field-helper">{t('password.hint')}</div>
        )}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-org">
          {t('org.label')} <span className="req">*</span>
        </label>
        <input
          id="signup-org"
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
            <span className="empty">{t('urlEmpty')}</span>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="auth-btn"
        disabled={!valid || submitting || googleSubmitting}
      >
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

      <div className="auth-footer-link">
        {t('haveAccount')} <a href="/login">{t('signInLink')}</a>
      </div>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.6z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.97 10.71A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
