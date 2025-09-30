import { Suspense } from 'react';

// Server Component - This is the static shell that will be prerendered
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden md:flex-row h-screen">
      {/* Static Sidebar Structure */}
      <div className="h-full px-4 py-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[60px] shrink-0">
        {/* Logo Area - Static */}
        <div className="relative z-20 flex items-center space-x-2 py-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 shrink-0 text-black dark:text-white"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
        </div>

        {/* Navigation Links Area - Static Structure */}
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="mt-8 flex flex-col gap-2">
            {/* Static placeholders for nav items */}
            <Suspense fallback={<NavItemSkeleton />}>
              {/* Dynamic navigation will be loaded here */}
            </Suspense>
          </div>
        </div>

        {/* Bottom Section - Static Structure */}
        <div className="flex flex-col gap-2">
          <Suspense fallback={<UserSkeleton />}>
            {/* Dynamic user section will be loaded here */}
          </Suspense>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Static Header Structure */}
        <header className="border-b bg-background">
          <div className="flex h-16 items-center justify-end px-6">
            <Suspense fallback={<ThemeToggleSkeleton />}>
              {/* Theme toggle will be loaded here */}
            </Suspense>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="container mx-auto">
            <Suspense fallback={<ContentSkeleton />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

// Static loading skeletons that match the exact dimensions
function NavItemSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-9 w-9 rounded-md bg-neutral-200/50 dark:bg-neutral-700/50 animate-pulse" />
      ))}
    </>
  );
}

function UserSkeleton() {
  return (
    <>
      <div className="h-9 w-9 rounded-full bg-neutral-200/50 dark:bg-neutral-700/50 animate-pulse" />
      <div className="h-9 w-9 rounded-md bg-neutral-200/50 dark:bg-neutral-700/50 animate-pulse" />
    </>
  );
}

function ThemeToggleSkeleton() {
  return <div className="h-10 w-10 rounded-full bg-neutral-200/50 dark:bg-neutral-700/50 animate-pulse" />;
}

function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-neutral-200/50 dark:bg-neutral-700/50 rounded animate-pulse" />
      <div className="h-32 bg-neutral-200/50 dark:bg-neutral-700/50 rounded animate-pulse" />
    </div>
  );
}