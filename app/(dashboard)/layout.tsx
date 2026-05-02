import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
      .select(
        'organization_id, is_superadmin, organization:organizations(slug, subscription_status, trial_ends_at, stripe_subscription_id)',
      )
      .eq('id', user.id)
      .single();
    const typedProfile = profile as
      | {
          organization_id?: string | null;
          is_superadmin?: boolean | null;
          organization?: {
            slug?: string;
            subscription_status?: string | null;
            trial_ends_at?: string | null;
            stripe_subscription_id?: string | null;
          } | null;
        }
      | null;
    // OAuth signups land on /welcome to pick an org name. If anyone reaches
    // the dashboard without that step (direct nav, mid-flow refresh), bounce
    // them back so the rest of the layout doesn't render against a missing
    // organization.
    if (!typedProfile?.organization_id) {
      redirect('/welcome');
    }
    // Beta-trial paywall: once trial_ends_at is in the past and no Stripe
    // subscription has been attached, route the user to /billing/required
    // instead of letting them into the dashboard. Superadmins bypass — they
    // need to operate the platform independently of any single org's billing.
    const org = typedProfile.organization;
    const trialExpired =
      org?.subscription_status === 'trialing' &&
      org?.trial_ends_at != null &&
      new Date(org.trial_ends_at).getTime() < Date.now() &&
      !org?.stripe_subscription_id;
    if (trialExpired && !typedProfile.is_superadmin) {
      redirect('/billing/required');
    }
    orgSlug = org?.slug ?? null;
  }

  const actingAs = user ? await resolveActingAsForUser(user.id) : null;
  if (actingAs?.organizationSlug) {
    orgSlug = actingAs.organizationSlug;
  }

  return (
    <UserProviderWrapper>
      <Suspense fallback={<DashboardSkeleton />}>
        {/* `dark` on the SidebarProvider wrapper forces both Tailwind's `dark:`
            variant and Shadcn's `--card` / `--background` / `--sidebar` CSS-var
            overrides for the entire dashboard subtree — so cards, inputs,
            dialogs stay consistent with the dark page bg even during the
            SSR→hydration window after navigating from the light marketing/auth
            surfaces (where next-themes hasn't yet re-stamped `.dark` onto
            <html>). globals.css already forces html bg to #000 for non-mkt
            routes, so this just keeps the contents in sync. Applied via
            className so we don't add an extra layout wrapper. */}
        <SidebarProvider defaultOpen={defaultOpen} className="dark">
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
