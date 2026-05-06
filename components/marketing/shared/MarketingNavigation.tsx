'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SketchButton, StickyTag } from '@/components/marketing/sketch';
import { SketchLocaleToggle } from '@/components/marketing/shared/SketchLocaleToggle';

const navLinks = [
  { href: '#how-it-works', key: 'howItWorks' },
  { href: '#features', key: 'features' },
  { href: '#use-cases', key: 'useCases' },
  { href: '#contact', key: 'contact' },
] as const;

// Each mobile menu link is a sticky note with deliberate variety: alternate
// rotation, alternate alignment, alternate paper / post-it tone. The grid
// breaks; the ink stays consistent.
const mobileLinkStyle = [
  { rotate: -2.5, align: 'self-start', tone: 'paper' as const },
  { rotate: 2, align: 'self-end', tone: 'postit' as const },
  { rotate: -1.5, align: 'self-start', tone: 'postit' as const },
  { rotate: 2.5, align: 'self-end', tone: 'paper' as const },
];

export function MarketingNavigation() {
  const t = useTranslations('marketing.nav');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const dialogTitleId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobile menu open: trap focus, close on Esc, lock body scroll, restore
  // focus to the trigger on close. Deliberately NOT wiring browser-back to
  // close the menu — the pushState/popstate trick fights Next's <Link>
  // navigation: tapping a menu link triggers our cleanup before Next's
  // route push lands, so a `history.back()` in the cleanup pops the user
  // back instead of letting them advance to the destination. Escape + the
  // X button + link clicks already cover every reasonable close path.
  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    // Move focus to the first menu item next tick (after the dialog renders).
    const id = window.setTimeout(() => {
      dialog
        ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
        ?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(id);
      // Restore focus to the trigger so keyboard users return to context.
      previousFocus?.focus?.();
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: scrolled ? 'rgba(253, 251, 247, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(140%) blur(8px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(140%) blur(8px)' : 'none',
        borderBottom: scrolled
          ? '2px dashed var(--mkt-border)'
          : '2px dashed transparent',
        transition: 'background 200ms ease, border-color 200ms ease',
        color: 'var(--mkt-fg)',
      }}
    >
      <div
        className="flex h-16 w-full items-center justify-between gap-6"
        style={{ paddingInline: 'clamp(1.25rem, 3vw, 2.5rem)' }}
      >
        <Link
          href="/"
          className="mkt-focus-ring inline-flex items-baseline gap-0.5"
          style={{
            fontFamily: 'var(--mkt-font-display)',
            color: 'var(--mkt-fg)',
            fontSize: '1.6rem',
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          <span>bayaan</span>
          <span style={{ color: 'var(--mkt-accent)' }}>.ai</span>
        </Link>

        <nav
          className="hidden items-center gap-7 md:flex"
          aria-label={t('primaryAria')}
        >
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="mkt-focus-ring mkt-link"
              style={{
                fontFamily: 'var(--mkt-font-body)',
                fontSize: '1.05rem',
                color: 'var(--mkt-fg)',
              }}
            >
              {t(`links.${link.key}`)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <SketchLocaleToggle compact />
          <Link
            href="/login"
            className="mkt-focus-ring mkt-link"
            style={{
              fontFamily: 'var(--mkt-font-body)',
              fontSize: '1.05rem',
              color: 'var(--mkt-fg)',
            }}
          >
            {t('signIn')}
          </Link>
          <SketchButton href="/signup" size="md">
            {t('getStarted')}
          </SketchButton>
        </div>

        <div className="flex items-center gap-2 md:hidden" style={{ zIndex: 50 }}>
          <SketchLocaleToggle compact />
          <button
            type="button"
            ref={triggerRef}
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            aria-controls={dialogId}
            onClick={() => setOpen((v) => !v)}
            className="mkt-focus-ring flex h-11 w-11 items-center justify-center"
            style={{
              color: 'var(--mkt-fg)',
              background: 'var(--mkt-bg-elev)',
              border: '2px solid var(--mkt-border)',
              borderRadius: 'var(--mkt-wobbly-md)',
              boxShadow: '3px 3px 0 0 var(--mkt-border)',
              position: 'relative',
              zIndex: 60,
            }}
          >
            {open ? <X size={20} strokeWidth={2.6} /> : <Menu size={20} strokeWidth={2.6} />}
          </button>
        </div>
      </div>

      {/* Mobile menu — full-screen sticky-note overlay */}
      {open && (
        <div
          ref={dialogRef}
          id={dialogId}
          className="md:hidden fixed inset-0"
          style={{
            // Sit above the page but below the header's button so the X stays
            // tappable.
            zIndex: 45,
            top: 64,
            background: 'var(--mkt-bg)',
            backgroundImage: 'radial-gradient(var(--mkt-border-soft) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            animation: 'mkt-menu-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            overflowY: 'auto',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <div
            className="flex flex-col gap-2 px-6 pt-10 pb-12"
            style={{ minHeight: '100%' }}
          >
            {/* Header tag */}
            <StickyTag rotate={-3} tone="postit">
              <span id={dialogTitleId}>{t('mobileMenuLabel')}</span>
            </StickyTag>

            {/* Nav links as tilted sticky-note cards */}
            <nav
              className="mt-8 flex flex-col gap-5"
              aria-label={t('mobileAria')}
            >
              {navLinks.map((link, i) => {
                const variant = mobileLinkStyle[i % mobileLinkStyle.length];
                const bg =
                  variant.tone === 'postit'
                    ? 'var(--mkt-postit)'
                    : 'var(--mkt-bg-elev)';
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`mkt-focus-ring relative inline-flex items-center justify-between gap-4 ${variant.align}`}
                    style={{
                      width: '78%',
                      maxWidth: 320,
                      background: bg,
                      color: 'var(--mkt-fg)',
                      border: '2.5px solid var(--mkt-border)',
                      borderRadius: 'var(--mkt-wobbly)',
                      boxShadow: '5px 5px 0 0 var(--mkt-border)',
                      padding: '1rem 1.25rem',
                      fontFamily: 'var(--mkt-font-display)',
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      lineHeight: 1.1,
                      textDecoration: 'none',
                      transform: `rotate(${variant.rotate}deg)`,
                      transition: 'transform 100ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <span>{t(`links.${link.key}`)}</span>
                    <ArrowRight
                      size={20}
                      strokeWidth={2.6}
                      aria-hidden
                      style={{ color: 'var(--mkt-accent)', flexShrink: 0 }}
                    />
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div
              aria-hidden
              className="mt-10"
              style={{ borderTop: '2px dashed var(--mkt-border)' }}
            />

            {/* Account actions */}
            <div className="mt-8 flex flex-col items-start gap-5">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mkt-focus-ring mkt-link"
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  fontSize: '1.15rem',
                  color: 'var(--mkt-fg)',
                }}
              >
                {t('signIn')}
              </Link>
              <SketchButton
                href="/signup"
                size="lg"
                onClick={() => setOpen(false)}
              >
                {t('getStarted')}
                <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
              </SketchButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
