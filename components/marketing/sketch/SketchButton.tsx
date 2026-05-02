'use client';

import Link from 'next/link';
import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse';
type Size = 'md' | 'lg';

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string;
  };

export type SketchButtonProps = ButtonAsButton | ButtonAsLink;

// Wobbly border-radius generated once per mount per button so each button has
// its own slightly different shape — reinforces the hand-drawn impression.
function wobblyRadius(seed: number) {
  const rand = (i: number) => {
    const x = Math.sin(seed * 9.9 + i * 3.7) * 10000;
    return Math.abs(x - Math.floor(x));
  };
  const a = 60 + rand(1) * 40; // 60–100%
  const b = 40 + rand(2) * 30;
  const c = 55 + rand(3) * 35;
  const d = 45 + rand(4) * 30;
  return `${a}% ${b}% ${c}% ${d}% / ${b}% ${a}% ${d}% ${c}%`;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--mkt-bg-elev)',
    color: 'var(--mkt-fg)',
    borderColor: 'var(--mkt-border)',
  },
  secondary: {
    background: 'var(--mkt-bg-sunken)',
    color: 'var(--mkt-fg)',
    borderColor: 'var(--mkt-border)',
  },
  inverse: {
    background: 'var(--mkt-fg)',
    color: 'var(--mkt-bg-elev)',
    borderColor: 'var(--mkt-fg)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--mkt-fg)',
    borderColor: 'transparent',
  },
};

export function SketchButton(props: SketchButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    ...rest
  } = props;

  // Stable per-button-render seed
  const seed = React.useRef(Math.floor(Math.random() * 1000)).current;
  const radius = React.useMemo(() => wobblyRadius(seed), [seed]);

  const isInverse = variant === 'inverse';
  const isGhost = variant === 'ghost';

  const sizeClasses =
    size === 'lg'
      ? 'h-14 px-7 text-[1.15rem]'
      : 'h-12 px-5 text-[1rem]';

  const baseClass = [
    'mkt-focus-ring inline-flex items-center justify-center gap-2',
    'border-[3px] font-normal',
    'transition-transform duration-100 ease-out will-change-transform',
    'select-none',
    sizeClasses,
    className,
  ].join(' ');

  const style: React.CSSProperties = {
    ...variantStyles[variant],
    fontFamily: 'var(--mkt-font-body)',
    borderRadius: radius,
    boxShadow: isGhost ? 'none' : 'var(--mkt-shadow-button)',
  };

  // Hover/active are achieved via CSS `:hover` / `:active` selectors on the
  // class so we don't need React state. We rely on a global stylesheet rule
  // declared below. To keep encapsulation, we attach a data attribute.
  const dataAttr = { 'data-sketch-btn': variant };

  if ('href' in props && typeof props.href === 'string') {
    return (
      <Link
        href={props.href}
        className={baseClass}
        style={style}
        {...dataAttr}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={baseClass}
      style={style}
      {...dataAttr}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
