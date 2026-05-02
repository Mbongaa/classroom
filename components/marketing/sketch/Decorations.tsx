'use client';

import * as React from 'react';

/**
 * Sketch-system decoration helpers. All are aria-hidden, pointer-events:none.
 * Used to layer hand-drawn flourishes onto sections without polluting the
 * semantic content layer.
 */

export function DashedArrow({
  className = '',
  style,
  direction = 'down-right',
  color = 'var(--mkt-fg)',
  width = 110,
  height = 80,
}: {
  className?: string;
  style?: React.CSSProperties;
  direction?: 'down-right' | 'down-left' | 'right' | 'left';
  color?: string;
  width?: number;
  height?: number;
}) {
  // Hand-drawn arrow path with dashed stroke + arrowhead. Direction rotates the
  // whole SVG around its center.
  const rotation =
    direction === 'down-right'
      ? 0
      : direction === 'down-left'
        ? -90
        : direction === 'right'
          ? -45
          : -135;

  return (
    <svg
      aria-hidden
      className={className}
      style={{ transform: `rotate(${rotation}deg)`, ...style }}
      width={width}
      height={height}
      viewBox="0 0 110 80"
      fill="none"
    >
      <path
        d="M 8 12 Q 30 30, 50 38 T 92 60"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 5"
        fill="none"
      />
      <path
        d="M 92 60 L 80 50 M 92 60 L 84 70"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function SquigglyLine({
  className = '',
  style,
  color = 'var(--mkt-border)',
  width = 200,
  height = 40,
}: {
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      preserveAspectRatio="none"
    >
      <path
        d={`M 4 ${height / 2} Q ${width * 0.25} ${height * 0.1}, ${width * 0.5} ${height / 2} T ${width - 4} ${height / 2}`}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 6"
        fill="none"
      />
    </svg>
  );
}

export function ScribbleCircle({
  size = 36,
  color = 'var(--mkt-accent)',
  strokeWidth = 2.4,
  className = '',
  style,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // A loose hand-drawn ellipse — used to ring icons in How It Works /
  // Use Cases.
  return (
    <svg
      aria-hidden
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
    >
      <path
        d="M 30 5 Q 50 8 54 28 Q 56 48 32 54 Q 10 56 6 33 Q 4 12 28 6 Q 32 5 30 5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function StickyTag({
  children,
  rotate = -2,
  tone = 'postit',
  className = '',
  style,
}: {
  children: React.ReactNode;
  rotate?: number;
  tone?: 'postit' | 'paper' | 'red';
  className?: string;
  style?: React.CSSProperties;
}) {
  const bg =
    tone === 'red'
      ? 'var(--mkt-accent)'
      : tone === 'paper'
        ? 'var(--mkt-bg-elev)'
        : 'var(--mkt-postit)';
  const fg = tone === 'red' ? 'var(--mkt-bg-elev)' : 'var(--mkt-fg)';

  return (
    <span
      className={`inline-block ${className}`}
      style={{
        background: bg,
        color: fg,
        fontFamily: 'var(--mkt-font-body)',
        fontSize: '0.95rem',
        padding: '0.4rem 0.95rem',
        border: '2px solid var(--mkt-border)',
        boxShadow: '3px 3px 0 0 var(--mkt-border)',
        borderRadius: '18px 4px 22px 6px / 6px 24px 4px 18px',
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function OrganicBlob({
  variant = 1,
  className = '',
  style,
  children,
}: {
  variant?: 1 | 2 | 3 | 4;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        background: 'var(--mkt-bg-elev)',
        border: '2px solid var(--mkt-border)',
        boxShadow: 'var(--mkt-shadow-card)',
        borderRadius: `var(--mkt-wobbly-blob-${variant})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PaperUnderline({
  width = '100%',
  color = 'var(--mkt-accent)',
  className = '',
  style,
}: {
  width?: string | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      style={{ width, height: 12, ...style }}
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M 4 8 Q 50 2 100 7 T 196 6"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function CornerMark({
  position,
  size = 28,
  color = 'var(--mkt-fg)',
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
  color?: string;
}) {
  const top = position.startsWith('t') ? -6 : undefined;
  const bottom = position.startsWith('b') ? -6 : undefined;
  const left = position.endsWith('l') ? -6 : undefined;
  const right = position.endsWith('r') ? -6 : undefined;
  const rotate =
    position === 'tl' ? 0 : position === 'tr' ? 90 : position === 'br' ? 180 : 270;
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        top,
        bottom,
        left,
        right,
        transform: `rotate(${rotate}deg)`,
        pointerEvents: 'none',
      }}
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
    >
      <path
        d="M 4 14 L 4 4 L 14 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
