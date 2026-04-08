import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { UserProviderWrapper } from '@/app/dashboard/user-provider-wrapper';
import AppSidebar from '@/components/dashboard-sidebar';
import { DashboardHeader } from '@/app/dashboard/dashboard-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

/**
 * /mosque-admin/[slug] layout
 *
 * Wraps the finance dashboard (and its settings sub-route) in the same shell
 * as the translation dashboard so users keep the sidebar + the
 * translation↔finance toggle when switching modes. The only differences from
 * `app/dashboard/layout.tsx`:
 *
 *   - `currentMode` is `'finance'` (drives the toggle highlight)
 *   - `orgSlug` comes from the route params, not from the user's primary org
 *     (so superadmins viewing a different org's finance dashboard get the
 *     correct slug for the back-toggle)
 *
 * The sidebar nav items still link to `/dashboard/*` routes — that's
 * intentional. Clicking a sidebar item navigates back to the translation
 * side; the header toggle is the explicit mode switch.
 */

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

// Skeleton matches the one in app/dashboard/layout.tsx so the visual shell
// stays identical during the suspense boundary.
function DashboardSkeleton() {
  return (
    <div className="flex w-full h-screen">
      <div className="h-full px-4 py-4 hidden md:flex md:flex-col bg-background w-[60px] shrink-0 border-r border-[rgba(128,128,128,0.3)]">
        <div className="animate-pulse">
          <div className="h-8 w-8 bg-sidebar-accent rounded mb-8" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-8 bg-sidebar-accent rounded" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-[rgba(128,128,128,0.3)] bg-background h-16" />
        <main className="flex-1 p-6">
          <div className="h-8 w-48 bg-sidebar-accent rounded animate-pulse" />
        </main>
      </div>
    </div>
  );
}

export default async function MosqueAdminLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  return (
    <UserProviderWrapper>
      <Suspense fallback={<DashboardSkeleton />}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader
              currentMode="finance"
              orgSlug={slug}
              showSidebarTrigger
            />
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
