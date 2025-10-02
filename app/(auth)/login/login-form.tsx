'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn } from '@/lib/actions/auth';
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
      {pending ? 'Signing in...' : 'Sign In'}
    </Button>
  );
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field-specific validation errors
  const [emailError, setEmailError] = useState('');

  // Track which fields have been touched
  const [touched, setTouched] = useState({
    email: false,
  });

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return '';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  // Calculate if form is valid (both fields filled AND no errors)
  const isFormValid = email.trim() !== '' && password.trim() !== '' && !emailError;

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await signIn(formData);
    if (!result.success && result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="grid gap-6">
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
          <FloatingLabelInput
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}
          <SubmitButton isFormValid={isFormValid} />
        </div>
      </form>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs uppercase text-gray-600 dark:text-gray-400">Or</span>
        <div className="w-full border-t border-[#4b5563]" />
      </div>
      <Button
        as="button"
        type="button"
        disabled
        borderRadius="1.75rem"
        containerClassName="w-full h-12"
        className="bg-transparent text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium"
        duration={3000}
      >
        <svg
          className="mr-2 h-4 w-4"
          aria-hidden="true"
          focusable="false"
          data-prefix="fab"
          data-icon="google"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 488 512"
        >
          <path
            fill="currentColor"
            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
          ></path>
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}
