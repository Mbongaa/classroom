'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { updatePassword } from '@/lib/actions/auth';
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
      {pending ? 'Updating...' : 'Update password'}
    </Button>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordError =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters'
      : '';

  const matchError =
    confirmPassword.length > 0 && password !== confirmPassword
      ? 'Passwords do not match'
      : '';

  const isFormValid =
    password.length >= 8 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updatePassword(formData);
    if (!result.success) {
      setError(result.error ?? 'Failed to update password');
      return;
    }
    router.push(result.redirectUrl ?? '/dashboard');
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <FloatingLabelInput
            id="password"
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {passwordError && (
            <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
          )}
        </div>
        <div className="grid gap-2">
          <FloatingLabelInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {matchError && (
            <p className="text-xs text-red-600 dark:text-red-400">{matchError}</p>
          )}
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}
        <SubmitButton isFormValid={isFormValid} />
      </div>
    </form>
  );
}
