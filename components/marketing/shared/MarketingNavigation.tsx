'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';

const navLinks = [
  { href: '#how-it-works', key: 'howItWorks' },
  { href: '#features', key: 'features' },
  { href: '#use-cases', key: 'useCases' },
  { href: '#pricing', key: 'pricing' },
] as const;

export function MarketingNavigation() {
  const t = useTranslations('marketing.nav');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: scrolled ? 'oklch(0.97 0.01 90 / 0.85)' : 'var(--mkt-bg)',
        backdropFilter: scrolled ? 'saturate(140%) blur(10px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(140%) blur(10px)' : 'none',
        borderBottom: scrolled
          ? '1px solid var(--mkt-border)'
          : '1px solid transparent',
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
          className="mkt-focus-ring text-[20px] font-bold tracking-tight"
          style={{ color: 'var(--mkt-fg)', letterSpacing: '-0.03em' }}
        >
          bayaan<span style={{ color: 'var(--mkt-brand)' }}>.ai</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label={t('primaryAria')}>
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="mkt-focus-ring text-[14px] font-medium transition-colors"
              style={{ color: 'var(--mkt-fg-muted)' }}
            >
              {t(`links.${link.key}`)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="mkt-focus-ring inline-flex h-9 items-center justify-center rounded-full px-4 text-[14px] font-medium"
            style={{ color: 'currentColor' }}
          >
            {t('signIn')}
          </Link>
          <Link
            href="/signup"
            className="mkt-focus-ring inline-flex h-9 items-center justify-center rounded-full px-5 text-[14px] font-semibold"
            style={{
              background: 'var(--mkt-brand)',
              color: 'oklch(0.99 0.005 165)',
            }}
          >
            {t('getStarted')}
          </Link>
          <ThemeToggleButton start="top-right" className="ml-1 size-9" />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggleButton start="top-right" className="size-9" />
          <button
            type="button"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="mkt-focus-ring flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: 'currentColor' }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="md:hidden"
          style={{
            background: 'var(--mkt-bg)',
            borderTop: '1px solid var(--mkt-border)',
          }}
        >
          <nav
            className="flex w-full flex-col gap-1 py-4"
            style={{ paddingInline: 'clamp(1.25rem, 3vw, 2.5rem)' }}
            aria-label={t('mobileAria')}
          >
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className="mkt-focus-ring rounded-lg px-3 py-3 text-[16px] font-medium"
                style={{ color: 'var(--mkt-fg)' }}
              >
                {t(`links.${link.key}`)}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--mkt-border)' }}>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mkt-focus-ring inline-flex h-11 items-center justify-center rounded-full text-[14px] font-medium"
                style={{
                  color: 'var(--mkt-fg)',
                  border: '1px solid var(--mkt-border-strong)',
                }}
              >
                {t('signIn')}
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="mkt-focus-ring inline-flex h-11 items-center justify-center rounded-full text-[14px] font-semibold"
                style={{
                  background: 'var(--mkt-brand)',
                  color: 'oklch(0.99 0.005 165)',
                }}
              >
                {t('getStarted')}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
