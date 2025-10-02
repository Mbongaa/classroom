'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        placeholder=" "
        className={cn(
          'peer h-12 w-full rounded-md border px-4 py-3 text-base transition-all',
          'border-[#4b5563]',
          'hover:border-[#6b7280]',
          'focus:outline-none focus:ring-4 focus:ring-[#434549] focus:ring-offset-1 focus:ring-offset-[#b8b2b2]',
          'focus-visible:ring-4 focus-visible:ring-[#434549] focus-visible:ring-offset-1 focus-visible:ring-offset-[#b8b2b2]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        style={{
          backgroundColor: 'var(--lk-bg)',
          color: 'var(--lk-text1, white)',
        }}
        ref={ref}
        {...props}
      />
    );
  },
);
FloatingInput.displayName = 'FloatingInput';

const FloatingLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  return (
    <Label
      className={cn(
        'absolute start-4 top-2 z-10 origin-[0] -translate-y-4 scale-75 transform px-2 text-sm duration-300',
        'bg-[var(--lk-bg)] text-gray-400',
        'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100',
        'peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2',
        'peer-focus:text-[var(--lk-text1,white)]',
        'dark:bg-[var(--lk-bg)] dark:text-gray-400 peer-focus:dark:text-[var(--lk-text1,white)]',
        'rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4',
        'cursor-text pointer-events-none',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
FloatingLabel.displayName = 'FloatingLabel';

type FloatingLabelInputProps = FloatingInputProps & {
  label?: string;
};

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ id, label, ...props }, ref) => {
    return (
      <div className="relative">
        <FloatingInput ref={ref} id={id} {...props} />
        <FloatingLabel htmlFor={id}>{label}</FloatingLabel>
      </div>
    );
  },
);
FloatingLabelInput.displayName = 'FloatingLabelInput';

export { FloatingInput, FloatingLabel, FloatingLabelInput };
