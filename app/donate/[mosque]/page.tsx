import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DonateLandingClient, type CampaignDisplay } from './DonateLandingClient';

/**
 * /donate/[mosque]
 *
 * Public org-level donation landing. Dual-pane layout:
 *   Left:  active campaigns (tap to select)
 *   Right: payment options (one-time / recurring SEPA)
 *
 * Entry points:
 *   1. Direct link: bayaan.app/donate/elfeth
 *   2. Subdomain:   elfeth.bayaan.app/donate (middleware rewrites here)
 *
 * The subdomain variant is the primary flow for the POS / kiosk tablet
 * sitting in the mosque entrance — the tablet browser opens the subdomain
 * and this page stays on screen permanently.
 *
 * No authentication required. Campaign data is fetched via the anon client
 * (public RLS policy). Raised amounts use the admin client because
 * transactions/direct_debits are service-role-only (donor PII).
 */

interface PageProps {
  params: Promise<{ mosque: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
}

interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
}

export default async function DonateLandingPage({ params }: PageProps) {
  const { mosque: slug } = await params;

  const supabase = await createClient();

  // Fetch org via public RLS policy (donations_active orgs only).
  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, description, city, country')
    .eq('slug', slug)
    .eq('donations_active', true)
    .single();

  if (!organization) {
    notFound();
  }

  // Active campaigns via anon client (public RLS).
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select<string, CampaignRow>('id, slug, title, description, goal_amount, cause_type, icon')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  const campaignList = campaigns ?? [];

  // Compute raised amounts per campaign. Admin client because transactions
  // and direct_debits have no public RLS policies.
  const raisedMap = new Map<string, number>();
  if (campaignList.length > 0) {
    const campaignIds = campaignList.map((c) => c.id);
    const supabaseAdmin = createAdminClient();
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

  const campaignsWithRaised: CampaignDisplay[] = campaignList.map((c) => ({
    ...c,
    raised_cents: raisedMap.get(c.id) ?? 0,
  }));

  return (
    <DonateLandingClient
      orgSlug={organization.slug}
      orgName={organization.name}
      orgCity={organization.city}
      orgCountry={organization.country}
      orgDescription={organization.description}
      campaigns={campaignsWithRaised}
    />
  );
}
