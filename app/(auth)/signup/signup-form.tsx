'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp } from '@/lib/actions/auth';
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
      {pending ? 'Creating account...' : 'Create Account'}
    </Button>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  // Field-specific validation errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Track which fields have been touched
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return '';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return '';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  // Calculate if form is valid (all required fields filled AND no errors)
  const isFormValid =
    fullName.trim() !== '' &&
    email.trim() !== '' &&
    password.length >= 8 &&
    orgName.trim() !== '' &&
    orgSlug.trim() !== '' &&
    !emailError &&
    !passwordError;

  function handleOrgNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setOrgName(name);
    setOrgSlug(slugify(name));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await signUp(formData);
    if (!result.success && result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="grid gap-6">
      <form action={handleSubmit}>
        <div className="grid gap-4">
          <FloatingLabelInput
            id="fullName"
            name="fullName"
            label="Full Name"
            type="text"
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
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
          <div className="grid gap-2">
            <FloatingLabelInput
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setPasswordError(validatePassword(e.target.value));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, password: true }));
                setPasswordError(validatePassword(password));
              }}
              required
              minLength={8}
            />
            {touched.password && passwordError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">Must be at least 8 characters</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase text-gray-600 dark:text-gray-400">Organization Details</span>
            <div className="w-full border-t border-[#4b5563]" />
          </div>

          <div className="grid gap-2">
            <FloatingLabelInput
              id="orgName"
              name="orgName"
              label="Organization Name"
              type="text"
              value={orgName}
              onChange={handleOrgNameChange}
              required
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Your school, company, or organization name
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">bayaan.app/</span>
              <FloatingLabelInput
                id="orgSlug"
                name="orgSlug"
                label="URL Slug"
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(slugify(e.target.value))}
                required
                className="flex-1"
                // No pattern attribute - slugify handles validation
              />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <SubmitButton isFormValid={isFormValid} />
        </div>
      </form>
    </div>
  );
}
