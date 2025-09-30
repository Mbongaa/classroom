import { Suspense } from 'react';
import { UserProviderWrapper } from './user-provider-wrapper';
import AppSidebar from '@/components/dashboard-sidebar';
import { DashboardHeader } from '@/app/dashboard/dashboard-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { cookies } from 'next/headers';

// Loading skeleton for the sidebar/content area
function DashboardSkeleton() {
  return (
    <div className="flex w-full h-screen">
      {/* Sidebar skeleton */}
      <div className="h-full px-4 py-4 hidden md:flex md:flex-col bg-sidebar w-[60px] shrink-0 border-r border-sidebar-border">
        <div className="animate-pulse">
          {/* Logo skeleton */}
          <div className="h-8 w-8 bg-sidebar-accent rounded mb-8" />
          {/* Nav items skeleton */}
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-8 bg-sidebar-accent rounded" />
            ))}
          </div>
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col">
        <header className="border-b border-sidebar-border bg-background h-16" />
        <main className="flex-1 p-6">
          <div className="h-8 w-48 bg-sidebar-accent rounded animate-pulse" />
        </main>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <UserProviderWrapper>
      <Suspense fallback={<DashboardSkeleton />}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto p-6">
              <div className="container mx-auto">{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </Suspense>
    </UserProviderWrapper>
  );
}