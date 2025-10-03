import { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '@/app/(auth)/signup/signup-form';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account',
};

export default function SignupPage() {
  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
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
              &ldquo;Setting up our virtual classrooms was incredibly easy. Within minutes, we were
              hosting live sessions with real-time translation for our international
              students.&rdquo;
            </p>
            <footer className="text-sm text-gray-600 dark:text-gray-400">Prof. Michael Chen, University of California</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">Create your organization</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter your information to get started with Bayaan Classroom
            </p>
          </div>
          <SignupForm />
          <p className="px-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
          <p className="px-8 text-center text-xs text-gray-600 dark:text-gray-400">
            By clicking continue, you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
