'use client';

import * as React from 'react';

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
};

export function SketchField({ label, required, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span
        style={{
          fontFamily: 'var(--mkt-font-body)',
          fontSize: '1rem',
          color: 'var(--mkt-fg)',
        }}
      >
        {label}
        {required && (
          <span aria-hidden style={{ color: 'var(--mkt-accent)' }}>
            {' *'}
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span
          style={{
            fontFamily: 'var(--mkt-font-body)',
            fontSize: '0.85rem',
            color: 'var(--mkt-fg-subtle)',
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const SketchInput = React.forwardRef<HTMLInputElement, InputProps>(
  function SketchInput({ className = '', style, ...rest }, ref) {
    return (
      <input
        ref={ref}
        data-sketch-input
        className={className}
        style={style}
        {...rest}
      />
    );
  },
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const SketchTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function SketchTextarea({ className = '', style, rows = 5, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        data-sketch-input
        className={className}
        style={{ resize: 'vertical', minHeight: 140, ...style }}
        {...rest}
      />
    );
  },
);
