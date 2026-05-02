'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { setLocale } from '@/app/actions/locale';
import { locales, localeLabels, type Locale } from '@/i18n/config';

const localeShort: Record<Locale, string> = {
  en: 'EN',
  nl: 'NL',
  de: 'DE',
  fr: 'FR',
  ar: 'AR',
};

const tones: Array<'paper' | 'postit' | 'blue' | 'green' | 'pink'> = [
  'paper',
  'postit',
  'blue',
  'green',
  'pink',
];
const toneToBg: Record<(typeof tones)[number], string> = {
  paper: 'var(--mkt-bg-elev)',
  postit: 'var(--mkt-postit)',
  blue: 'var(--mkt-postit-blue)',
  green: 'var(--mkt-postit-green)',
  pink: 'var(--mkt-postit-pink)',
};
const rotations = [-2, 1.5, -1.5, 2, -1];

interface Props {
  /** Compact = just the code (EN/NL/...). Otherwise shows full label. */
  compact?: boolean;
  /** Drop direction for the popover. */
  align?: 'right' | 'left';
}

export function SketchLocaleToggle({ compact = true, align = 'right' }: Props) {
  const current = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (loc: Locale) => {
    if (loc === current) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(() => {
      void setLocale(loc);
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Language: ${localeLabels[current]}`}
        onClick={() => setOpen((v) => !v)}
        className="mkt-focus-ring inline-flex items-center gap-1.5"
        style={{
          background: 'var(--mkt-bg-elev)',
          color: 'var(--mkt-fg)',
          border: '2px solid var(--mkt-border)',
          // Wrinkled square shape — matches the hamburger button so the
          // pair on the right side of the nav reads as siblings.
          borderRadius: 'var(--mkt-wobbly-md)',
          boxShadow: '3px 3px 0 0 var(--mkt-border)',
          padding: '0 0.7rem',
          fontFamily: 'var(--mkt-font-body)',
          fontSize: '0.95rem',
          height: 44,
          minWidth: 64,
          transition: 'transform 100ms cubic-bezier(0.22, 1, 0.36, 1)',
          transform: open ? 'translate(2px, 2px)' : undefined,
        }}
      >
        <span aria-hidden style={{ fontFamily: 'var(--mkt-font-display)', fontWeight: 700 }}>
          {compact ? localeShort[current] : localeLabels[current]}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.6}
          aria-hidden
          style={{
            transition: 'transform 120ms cubic-bezier(0.22, 1, 0.36, 1)',
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        />
      </button>

      {open && (
        <ul
          id={panelId}
          role="listbox"
          aria-label="Choose language"
          className="absolute z-50"
          style={{
            top: 'calc(100% + 10px)',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            background: 'var(--mkt-bg-elev)',
            border: '2.5px solid var(--mkt-border)',
            borderRadius: 'var(--mkt-wobbly)',
            boxShadow: '6px 6px 0 0 var(--mkt-border)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
            minWidth: 180,
            animation: 'mkt-menu-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {locales.map((loc, i) => {
            const isCurrent = loc === current;
            const tone = tones[i % tones.length];
            const rotate = rotations[i % rotations.length];
            return (
              <li key={loc} role="option" aria-selected={isCurrent}>
                <button
                  type="button"
                  onClick={() => handlePick(loc)}
                  className="mkt-focus-ring w-full text-left inline-flex items-center justify-between gap-3"
                  style={{
                    background: toneToBg[tone],
                    border: '2px solid var(--mkt-border)',
                    borderRadius: 'var(--mkt-wobbly-md)',
                    padding: '0.55rem 0.85rem',
                    fontFamily: 'var(--mkt-font-body)',
                    fontSize: '1rem',
                    color: 'var(--mkt-fg)',
                    transform: `rotate(${rotate}deg)`,
                    boxShadow: '3px 3px 0 0 var(--mkt-border)',
                    cursor: 'pointer',
                    minHeight: 40,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mkt-font-display)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      width: 24,
                      flexShrink: 0,
                    }}
                  >
                    {localeShort[loc]}
                  </span>
                  <span style={{ flex: 1 }}>{localeLabels[loc]}</span>
                  {isCurrent && (
                    <span aria-hidden style={{ color: 'var(--mkt-accent-deep)', fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
