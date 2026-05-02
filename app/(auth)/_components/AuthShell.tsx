'use client';

import * as React from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Mode = 'signin' | 'signup';

interface AuthShellProps {
  mode: Mode;
  children: React.ReactNode;
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
export function AuthShell({ mode, children }: AuthShellProps) {
  const router = useRouter();

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

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    router.push(next === 'signup' ? '/signup' : '/login');
  };

  return (
    <div data-mkt-root className="auth-stage">
      <LeftPane mode={mode} />

      <div className="auth-right">
        <div className="auth-right-inner">
          {/* Decorative sticky tucked bottom-right */}
          <div
            aria-hidden
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
            🔒 Audio never leaves your masjid
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
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeftPane({ mode }: { mode: Mode }) {
  return (
    <div className="auth-left">
      <div className="auth-left-grain" aria-hidden />

      <div className="auth-left-head">
        <Link
          href="/"
          className="auth-logo"
          style={{ color: 'var(--mkt-bg-elev)' }}
        >
          <span className="auth-logo-mark" aria-hidden>
            B
          </span>
          <span>bayaan</span>
        </Link>
        <span
          aria-hidden
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
          BETA · Free
        </span>
      </div>

      <div className="auth-left-body">
        <h1 className="auth-left-headline">
          The khutbah,
          <br />
          in <span className="auth-marker-yellow">every language</span>.
        </h1>
        <p className="auth-left-lead">
          Live captions for jummah — no app, no setup.{' '}
          {mode === 'signup'
            ? 'Sign up and run your first translated jummah this Friday.'
            : 'Welcome back, sign in to manage your masjid.'}
        </p>

        {/* Mock translation caption */}
        <div className="auth-mock-caption">
          <span className="auth-mock-tag">Imam · Arabic</span>
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
            EN
          </span>
          <div style={{ fontSize: 16 }}>
            All praise is due to Allah, we praise Him
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
            <strong style={{ color: 'var(--mkt-bg-elev)' }}>47 masjids</strong>{' '}
            already on Bayaan
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            UK · US · Canada · UAE
          </div>
        </div>
      </div>

      {/* Decorative testimonial sticky */}
      <div
        aria-hidden
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
        ✨ &ldquo;Setup took 6 min. Six!&rdquo; — <em>Br. Tariq</em>
      </div>
    </div>
  );
}
