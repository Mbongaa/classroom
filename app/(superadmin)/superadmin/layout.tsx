import { Suspense } from 'react';
import { UserProviderWrapper } from '@/app/dashboard/user-provider-wrapper';
import SuperadminSidebar from '@/components/superadmin-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cookies } from 'next/headers';

function SuperadminSkeleton() {
  return (
    <div className="flex w-full h-screen">
      <div className="h-full px-4 py-4 hidden md:flex md:flex-col bg-sidebar w-[60px] shrink-0 border-r border-sidebar-border">
        <div className="animate-pulse">
          <div className="h-8 w-8 bg-sidebar-accent rounded mb-8" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-8 bg-sidebar-accent rounded" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-sidebar-border bg-background h-16" />
        <main className="flex-1 p-6">
          <div className="h-8 w-48 bg-sidebar-accent rounded animate-pulse" />
        </main>
      </div>
    </div>
  );
}

function SuperadminHeader() {
  return (
    <header className="border-b border-[rgba(128,128,128,0.3)] bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            bayaan.ai
          </span>
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Superadmin
          </span>
        </div>
        <ThemeToggleButton start="top-right" />
      </div>
    </header>
  );
}

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <UserProviderWrapper>
      <Suspense fallback={<SuperadminSkeleton />}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SuperadminSidebar />
          <SidebarInset>
            <SuperadminHeader />
            <main
              className="flex-1 overflow-y-auto p-6 min-h-0"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="container mx-auto">{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </Suspense>
    </UserProviderWrapper>
  );
}
