import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireFinanceAccessBySlug } from '@/lib/finance-access';
import { CampaignsClient, type Campaign, type CampaignWithRaised } from './CampaignsClient';

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
  'id, organization_id, slug, title, description, goal_amount, cause_type, icon, is_active, sort_order, created_at, updated_at';

export default async function CampaignsPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('mosqueAdmin.campaigns');
  const tRoot = await getTranslations('mosqueAdmin');
  const { supabaseAdmin } = await requireFinanceAccessBySlug(
    slug,
    `/mosque-admin/${slug}/campaigns`,
  );

  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  const canManage = true;
  const canDelete = true;

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select<string, Campaign>(CAMPAIGN_COLUMNS)
    .eq('organization_id', organization.id)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  // Compute per-campaign raised amounts from both one-time transactions
  // (status=PAID) and recurring direct debits (status=COLLECTED, joined
  // through mandates.campaign_id). We sum in JS — the data volume per org
  // is small enough that two flat queries + a reduce is faster and simpler
  // than a SQL aggregate view.
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const raisedMap = new Map<string, number>();

  if (campaignIds.length > 0) {
    const [txResult, ddResult] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('campaign_id, amount')
        .in('campaign_id', campaignIds)
        .eq('status', 'PAID'),
      supabaseAdmin
        .from('direct_debits')
        .select('amount, mandates!inner(campaign_id)')
        .in('mandates.campaign_id', campaignIds)
        .eq('status', 'COLLECTED'),
    ]);

    for (const row of txResult.data ?? []) {
      raisedMap.set(row.campaign_id, (raisedMap.get(row.campaign_id) ?? 0) + (row.amount ?? 0));
    }
    for (const row of ddResult.data ?? []) {
      const cid = Array.isArray((row as any).mandates)
        ? (row as any).mandates[0]?.campaign_id
        : (row as any).mandates?.campaign_id;
      if (cid) {
        raisedMap.set(cid, (raisedMap.get(cid) ?? 0) + (row.amount ?? 0));
      }
    }
  }

  const campaignsWithRaised: CampaignWithRaised[] = (campaigns ?? []).map((c) => ({
    ...c,
    raised_cents: raisedMap.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {tRoot('prefix')}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('pageSubtitle', { name: organization.name })}
          </p>
        </div>
        <Link
          href={`/mosque-admin/${organization.slug}`}
          className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {tRoot('backToDashboard')}
        </Link>
      </div>

      <CampaignsClient
        organizationId={organization.id}
        organizationSlug={organization.slug}
        initialCampaigns={campaignsWithRaised}
        canManage={canManage}
        canDelete={canDelete}
      />
    </div>
  );
}
