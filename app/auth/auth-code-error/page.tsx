import { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';

export const metadata: Metadata = {
  title: 'Authentication error',
  description: 'There was a problem confirming your link',
};

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

const reasonMessages: Record<string, string> = {
  missing_params: 'The link is missing required information.',
  // Common Supabase error messages — humanized
  'Token has expired or is invalid':
    'This link has expired or has already been used. Please request a new one.',
  'Email link is invalid or has expired':
    'This link has expired or has already been used. Please request a new one.',
};

export default async function AuthCodeErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const friendlyReason = reason
    ? (reasonMessages[reason] ?? decodeURIComponent(reason))
    : 'We couldn&apos;t verify your link.';

  return (
    <div className="container relative min-h-screen grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggleButton start="top-right" />
      </div>

      <div className="relative hidden h-full flex-col bg-muted p-10 lg:flex border-r border-[#4b5563]">
        <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium text-black dark:text-white">
          Bayaan Classroom
        </div>
      </div>

      <div className="overflow-y-auto py-8 lg:p-8">
        <div className="mx-auto flex w-full flex-col space-y-6 sm:w-[400px] my-auto">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
              Something went wrong
            </h1>
            <p
              className="text-sm text-gray-600 dark:text-gray-400"
              dangerouslySetInnerHTML={{ __html: friendlyReason }}
            />
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Email links expire after 1 hour and can only be used once. If you waited
              too long or clicked the link twice, just request a new one.
            </p>
          </div>

          <div className="grid gap-3">
            <Link
              href="/forgot-password"
              className="text-center text-sm underline underline-offset-4 hover:text-primary"
            >
              Request a new password reset link
            </Link>
            <Link
              href="/login"
              className="text-center text-sm underline underline-offset-4 hover:text-primary"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
