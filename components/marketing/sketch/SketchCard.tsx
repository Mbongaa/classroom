'use client';

import * as React from 'react';

type Decoration = 'none' | 'tape' | 'tape-double' | 'tack' | 'tack-blue';
type Tone = 'paper' | 'postit' | 'sunken';

export interface SketchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  decoration?: Decoration;
  tone?: Tone;
  rotate?: number; // degrees, e.g. -1.5
  hoverJiggle?: boolean;
  emphasized?: boolean; // 8px shadow instead of 4px
  radiusVariant?: 'a' | 'b';
  as?: keyof JSX.IntrinsicElements;
  children: React.ReactNode;
}

const toneStyles: Record<Tone, React.CSSProperties> = {
  paper: { background: 'var(--mkt-bg-elev)' },
  postit: { background: 'var(--mkt-postit)' },
  sunken: { background: 'var(--mkt-bg-sunken)' },
};

export function SketchCard({
  decoration = 'none',
  tone = 'paper',
  rotate = 0,
  hoverJiggle = false,
  emphasized = false,
  radiusVariant = 'a',
  as: Tag = 'div',
  className = '',
  style,
  children,
  ...rest
}: SketchCardProps) {
  const radius =
    radiusVariant === 'a' ? 'var(--mkt-wobbly)' : 'var(--mkt-wobbly-md)';

  const composedStyle: React.CSSProperties = {
    ...toneStyles[tone],
    border: '2px solid var(--mkt-border)',
    borderRadius: radius,
    boxShadow: emphasized
      ? 'var(--mkt-shadow-card-strong)'
      : 'var(--mkt-shadow-card)',
    padding: 'clamp(1.5rem, 2.4vw, 2rem)',
    transform: rotate ? `rotate(${rotate}deg)` : undefined,
    transition:
      'transform 120ms var(--mkt-ease-snap), box-shadow 120ms var(--mkt-ease-snap)',
    position: 'relative',
    color: 'var(--mkt-fg)',
    ...style,
  };

  const className2 = [
    hoverJiggle ? 'mkt-card-jiggle' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // We intentionally type loosely here; Tag is a valid intrinsic element.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = Tag as any;

  return (
    <Component
      className={className2}
      style={composedStyle}
      data-sketch-card
      data-rotate={rotate}
      {...rest}
    >
      {decoration !== 'none' && <CardDecoration kind={decoration} />}
      {children}
    </Component>
  );
}

function CardDecoration({ kind }: { kind: Decoration }) {
  if (kind === 'tape') {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -10,
          left: '50%',
          transform: 'translateX(-50%) rotate(-3deg)',
          width: 80,
          height: 22,
          background: 'rgba(80, 80, 80, 0.18)',
          border: '1px solid rgba(45, 45, 45, 0.18)',
          borderRadius: 2,
        }}
      />
    );
  }
  if (kind === 'tape-double') {
    return (
      <>
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -10,
            left: 24,
            transform: 'rotate(-6deg)',
            width: 70,
            height: 20,
            background: 'rgba(80, 80, 80, 0.16)',
            border: '1px solid rgba(45, 45, 45, 0.16)',
            borderRadius: 2,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -10,
            right: 24,
            transform: 'rotate(5deg)',
            width: 70,
            height: 20,
            background: 'rgba(80, 80, 80, 0.16)',
            border: '1px solid rgba(45, 45, 45, 0.16)',
            borderRadius: 2,
          }}
        />
      </>
    );
  }
  if (kind === 'tack' || kind === 'tack-blue') {
    const fill = kind === 'tack-blue' ? '#2d5da1' : '#ff4d4d';
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${fill} 0%, ${fill} 55%, ${darken(fill)} 100%)`,
          border: '2px solid var(--mkt-border)',
          boxShadow: '2px 2px 0 0 var(--mkt-border)',
        }}
      />
    );
  }
  return null;
}

function darken(hex: string) {
  // Simple visual nudge — used for the tack inner ring.
  if (hex === '#ff4d4d') return '#a62929';
  if (hex === '#2d5da1') return '#1a3a6c';
  return hex;
}
