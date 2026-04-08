'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordReset } from '@/lib/actions/auth';
import { Button } from '@/components/ui/moving-border';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';

function SubmitButton({ isFormValid }: { isFormValid: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      as="button"
      type="submit"
      disabled={!isFormValid || pending}
      borderRadius="1.75rem"
      containerClassName="w-full h-12"
      className={
        isFormValid && !pending
          ? 'bg-[#f1f2f4] dark:bg-[#111418] text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
          : 'bg-transparent text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
      }
      duration={3000}
    >
      {pending ? 'Sending...' : 'Send reset link'}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [touched, setTouched] = useState({ email: false });

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return '';
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return '';
  };

  const isFormValid = email.trim() !== '' && !emailError;

  async function handleSubmit(formData: FormData) {
    await requestPasswordReset(formData);
    // Always show success — protects against account enumeration
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="grid gap-4">
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4">
          <p className="text-sm text-green-900 dark:text-green-200">
            <strong>Check your inbox.</strong>
          </p>
          <p className="mt-2 text-sm text-green-800 dark:text-green-300">
            If an account exists for that email, we&apos;ve sent a password reset link.
            The link will expire in 1 hour.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setEmail('');
            setTouched({ email: false });
          }}
          className="text-sm text-gray-600 dark:text-gray-400 underline underline-offset-4 hover:text-primary"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <FloatingLabelInput
            id="email"
            name="email"
            label="Email"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (touched.email) {
                setEmailError(validateEmail(e.target.value));
              }
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, email: true }));
              setEmailError(validateEmail(email));
            }}
            required
          />
          {touched.email && emailError && (
            <p className="text-xs text-red-600 dark:text-red-400">{emailError}</p>
          )}
        </div>
        <SubmitButton isFormValid={isFormValid} />
      </div>
    </form>
  );
}
