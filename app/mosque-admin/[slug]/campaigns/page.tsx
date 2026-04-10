import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CampaignsClient, type Campaign } from './CampaignsClient';

/**
 * /mosque-admin/[slug]/campaigns
 *
 * Campaign management page for a single organization. Same auth pattern as
 * the dashboard and settings pages: server component handles auth + data
 * fetch via the admin client (so superadmins viewing a different org get
 * the same shape), then hands off to a client component for the
 * interactive list + create/edit dialogs.
 *
 * Read role gate: anyone in the org (admin / teacher / student) can view
 * the list. The dialogs themselves are gated by `canManage`, which the
 * server resolves once and the client trusts for UI affordances. The API
 * routes re-check the role on every write — this prop is purely for
 * hiding buttons.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
}

const CAMPAIGN_COLUMNS =
  'id, organization_id, slug, title, description, goal_amount, cause_type, is_active, created_at, updated_at';

export default async function CampaignsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}/campaigns`);
  }

  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Membership + role check.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();
  const isSuperadmin = profile?.is_superadmin === true;

  let userRole: 'admin' | 'teacher' | 'student' | 'superadmin' | null = isSuperadmin
    ? 'superadmin'
    : null;

  if (!isSuperadmin) {
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      notFound();
    }
    userRole = membership.role as 'admin' | 'teacher' | 'student';
  }

  // Anyone in the org can view; admins and teachers can manage; only
  // admins (and superadmins) can delete.
  const canManage = userRole === 'admin' || userRole === 'teacher' || userRole === 'superadmin';
  const canDelete = userRole === 'admin' || userRole === 'superadmin';

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select<string, Campaign>(CAMPAIGN_COLUMNS)
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Mosque admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {organization.name} — manage donation causes shown on your donate page
          </p>
        </div>
        <Link
          href={`/mosque-admin/${organization.slug}`}
          className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          ← Back to dashboard
        </Link>
      </div>

      <CampaignsClient
        organizationId={organization.id}
        organizationSlug={organization.slug}
        initialCampaigns={campaigns ?? []}
        canManage={canManage}
        canDelete={canDelete}
      />
    </div>
  );
}
