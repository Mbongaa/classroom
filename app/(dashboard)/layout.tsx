import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';
import { UserProviderWrapper } from '@/components/user-provider-wrapper';
import AppSidebar from '@/components/dashboard-sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

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

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgSlug: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization:organizations(slug)')
      .eq('id', user.id)
      .single();
    const organization = (profile as { organization?: { slug?: string } | null } | null)
      ?.organization;
    orgSlug = organization?.slug ?? null;
  }

  const actingAs = user ? await resolveActingAsForUser(user.id) : null;
  if (actingAs?.organizationSlug) {
    orgSlug = actingAs.organizationSlug;
  }

  return (
    <UserProviderWrapper>
      <Suspense fallback={<DashboardSkeleton />}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            {actingAs ? <ImpersonationBanner actingAs={actingAs} /> : null}
            <DashboardHeader orgSlug={orgSlug} showSidebarTrigger />
            <main
              className="flex-1 overflow-y-auto p-6 min-h-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="container mx-auto">{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </Suspense>
    </UserProviderWrapper>
  );
}
