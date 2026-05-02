'use client';

import * as React from 'react';

interface PaperclipProps {
  size?: 'sm' | 'md' | 'lg';
  /** Rotation in degrees — small angles look most natural. */
  rotate?: number;
  /** Distance the clip's top sits above the parent's top edge. */
  offsetTop?: number;
  /** Horizontal placement — pixel value or CSS value (e.g. "50%"). */
  left?: number | string;
  /** Same as `left` but anchored from the right. */
  right?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SIZES: Record<NonNullable<PaperclipProps['size']>, { w: number; h: number; top: number }> = {
  sm: { w: 20, h: 44, top: -12 },
  md: { w: 28, h: 60, top: -16 },
  lg: { w: 36, h: 78, top: -20 },
};

/**
 * Pencil-grey wire paperclip slipped over the top edge of a paper card.
 * Always aria-hidden + pointer-events: none — purely decorative.
 */
export function Paperclip({
  size = 'md',
  rotate = 0,
  offsetTop,
  left,
  right,
  color = '#9aa3ad',
  className = '',
  style,
}: PaperclipProps) {
  const { w, h, top } = SIZES[size];
  const resolvedTop = offsetTop ?? top;

  return (
    <svg
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        top: resolvedTop,
        left: left ?? (right === undefined ? 22 : undefined),
        right: right,
        width: w,
        height: h,
        zIndex: 3,
        pointerEvents: 'none',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        transformOrigin: 'top center',
        filter: 'drop-shadow(1px 2px 0 rgba(45,45,45,0.22))',
        ...style,
      }}
      viewBox="0 0 30 64"
      fill="none"
    >
      <path
        d="M 22 8 C 22 4, 18 4, 14 4 C 10 4, 6 6, 6 12 L 6 50 C 6 56, 12 58, 16 58 C 20 58, 24 56, 24 50 L 24 18 C 24 14, 20 12, 18 14 C 16 16, 16 20, 16 22 L 16 46"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
