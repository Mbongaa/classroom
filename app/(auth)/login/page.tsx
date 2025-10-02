import { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/app/(auth)/login/login-form';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account',
};

export default function LoginPage() {
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
              &ldquo;This platform has transformed how we conduct live teaching sessions. The
              real-time translation feature is a game-changer for our multilingual
              classrooms.&rdquo;
            </p>
            <footer className="text-sm text-gray-600 dark:text-gray-400">Dr. Sarah Johnson, Educational Director</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">Welcome back</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter your email to sign in to your account
            </p>
          </div>
          <LoginForm />
          <p className="px-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="underline underline-offset-4 hover:text-primary">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
