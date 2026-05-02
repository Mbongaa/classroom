'use client';

import { useMemo, useState } from 'react';
import { signUp } from '@/lib/actions/auth';
import { slugify } from '@/lib/slugify';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function SketchSignUpForm() {
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
  const [bannerErr, setBannerErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const slug = useMemo(() => slugify(org), [org]);

  const errs = {
    name: touched.name && !name ? 'Please enter your full name' : '',
    email:
      touched.email && email && !isEmail(email)
        ? "That doesn't look like a valid email"
        : touched.email && !email
          ? 'Email required'
          : '',
    password:
      touched.password && password && password.length < 8
        ? 'Must be at least 8 characters'
        : touched.password && !password
          ? 'Password required'
          : '',
    org: touched.org && !org ? 'Tell us your masjid or center name' : '',
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
      setBannerErr('Something went wrong. Please try again.');
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
            Mabrook!
          </span>
        </h3>
        <p style={{ fontSize: 17, marginBottom: 4, fontFamily: 'var(--mkt-font-body)' }}>
          Your account at <strong>bayaan.app/{slug}</strong> is ready.
        </p>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(45,45,45,0.6)',
            marginBottom: 18,
            fontFamily: 'var(--mkt-font-body)',
          }}
        >
          {redirectUrl ? 'Redirecting…' : 'Redirecting to your dashboard…'}
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
        Set up your{' '}
        <span
          style={{
            background:
              'linear-gradient(180deg, transparent 55%, rgba(255,77,77,0.35) 55%, rgba(255,77,77,0.35) 92%, transparent 92%)',
            padding: '0 4px',
          }}
        >
          masjid
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
        Free during beta · no card required
      </p>

      {bannerErr && (
        <div className="auth-banner" role="alert">
          <span style={{ fontSize: 18 }} aria-hidden>
            ⚠️
          </span>
          <div>{bannerErr}</div>
        </div>
      )}

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-name">
          Full name <span className="req">*</span>
        </label>
        <input
          id="signup-name"
          type="text"
          className={`auth-field ${errs.name ? 'is-error' : ''}`}
          placeholder="Yusuf Ahmed"
          autoComplete="name"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          required
        />
        {errs.name && <div className="auth-field-error">↳ {errs.name}</div>}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-email">
          Email <span className="req">*</span>
        </label>
        <input
          id="signup-email"
          type="email"
          className={`auth-field ${errs.email ? 'is-error' : ''}`}
          placeholder="imam@yourmasjid.org"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          required
        />
        {errs.email && <div className="auth-field-error">↳ {errs.email}</div>}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-password">
          Password <span className="req">*</span>
        </label>
        <input
          id="signup-password"
          type="password"
          className={`auth-field ${errs.password ? 'is-error' : ''}`}
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          required
          minLength={8}
        />
        {errs.password ? (
          <div className="auth-field-error">↳ {errs.password}</div>
        ) : (
          <div className="auth-field-helper">Must be at least 8 characters</div>
        )}
      </div>

      <div className="auth-field-group">
        <label className="auth-field-label" htmlFor="signup-org">
          Organization name <span className="req">*</span>
        </label>
        <input
          id="signup-org"
          type="text"
          className={`auth-field ${errs.org ? 'is-error' : ''}`}
          placeholder="Masjid Al-Noor"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, org: true }))}
          required
        />
        {errs.org ? (
          <div className="auth-field-error">↳ {errs.org}</div>
        ) : (
          <div className="auth-field-helper">Your mosque, school, or Islamic center</div>
        )}
        <div className="auth-url-preview" aria-live="polite">
          <span style={{ fontSize: 14 }} aria-hidden>
            🌐
          </span>
          <span className="domain">bayaan.app/</span>
          {slug ? (
            <span className="slug">{slug}</span>
          ) : (
            <span className="empty">your-masjid</span>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="auth-btn"
        disabled={!valid || submitting}
      >
        {submitting ? (
          <>
            <span className="auth-spinner" /> Creating account…
          </>
        ) : (
          'Create Account'
        )}
      </button>

      <div className="auth-submit-helper">
        <span className="marker">Free during beta</span> — no credit card required.
      </div>

      <div className="auth-footer-link">
        Already have an account? <a href="/login">Sign in</a>
      </div>
    </form>
  );
}
