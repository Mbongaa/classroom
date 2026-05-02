'use client';

import { useState } from 'react';
import { signIn } from '@/lib/actions/auth';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function SketchSignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [bannerErr, setBannerErr] = useState('');

  const errs = {
    email:
      touched.email && email && !isEmail(email)
        ? "That doesn't look like a valid email"
        : touched.email && !email
          ? 'Email required'
          : '',
    password: touched.password && !password ? 'Password required' : '',
  };
  const valid = isEmail(email) && password.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!valid) return;
    setBannerErr('');
    setSubmitting(true);

    const fd = new FormData();
    fd.set('email', email);
    fd.set('password', password);

    try {
      const result = await signIn(fd);
      // signIn calls redirect() on success — we only land here on failure.
      if (result && !result.success && result.error) {
        setBannerErr(result.error);
      }
    } catch (err) {
      // Next.js's redirect() throws — re-throw so navigation occurs.
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      setBannerErr('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        Welcome{' '}
        <span
          style={{
            textDecoration: 'underline wavy var(--mkt-accent)',
            textUnderlineOffset: '6px',
            textDecorationThickness: '2px',
          }}
        >
          back
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
        Sign in to manage translations &amp; your sermon archive.
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
        <label className="auth-field-label" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          name="email"
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

      <div className="auth-field-group" style={{ marginBottom: 6 }}>
        <label className="auth-field-label" htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          className={`auth-field ${errs.password ? 'is-error' : ''}`}
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          required
        />
        {errs.password && <div className="auth-field-error">↳ {errs.password}</div>}
      </div>
      <div className="auth-forgot">
        <a href="/forgot-password">Forgot password?</a>
      </div>

      <button
        type="submit"
        className="auth-btn"
        disabled={!valid || submitting}
      >
        {submitting ? (
          <>
            <span className="auth-spinner" /> Signing in…
          </>
        ) : (
          'Sign In'
        )}
      </button>

      <div className="auth-or">OR</div>

      <button
        type="button"
        className="auth-btn auth-btn-ghost"
        disabled
        title="Google sign-in coming soon"
      >
        <GoogleIcon /> Continue with Google
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            marginLeft: 6,
            background: 'var(--mkt-border-soft)',
            border: '1.5px solid var(--mkt-border)',
            borderRadius: 12,
          }}
        >
          soon
        </span>
      </button>

      <div className="auth-footer-link">
        Don&apos;t have an account?{' '}
        <a href="/signup">Sign up</a>
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
