import { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/app/(auth)/reset-password/reset-password-form';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: 'Set new password',
  description: 'Choose a new password for your Bayaan Classroom account',
};

export default function ResetPasswordPage() {
  return (
    <div className="container relative min-h-screen grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggleButton start="top-right" />
      </div>

      <div className="relative hidden h-full flex-col bg-muted p-10 lg:flex border-r border-[#4b5563]">
        <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium text-black dark:text-white">
          Bayaan Classroom
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg text-black dark:text-white">
              &ldquo;Choose a strong password — at least 8 characters, and ideally a
              mix of letters, numbers, and symbols.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
      <div className="overflow-y-auto py-8 lg:p-8">
        <div className="mx-auto flex w-full flex-col space-y-6 sm:w-[350px] my-auto">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
              Set new password
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose a new password for your account
            </p>
          </div>
          <ResetPasswordForm />
          <p className="px-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Need a new reset link?{' '}
            <Link
              href="/forgot-password"
              className="underline underline-offset-4 hover:text-primary"
            >
              Request again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
