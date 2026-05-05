import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { KioskDisplayClient, type KioskCampaign } from './KioskDisplayClient';

/**
 * /kiosk/[mosque]
 *
 * Passive kiosk display. No touch interactions — runs on any screen
 * (TV, tablet, monitor) at the mosque. Shows:
 *   - org name + city
 *   - rotating campaign cards (10s each)
 *   - permanent QR code pointing to /donate/[mosque]
 *
 * The donor scans the QR with their phone, lands on the chooser, and picks
 * Member vs One-time → /donate/[mosque]/member or /donate/[mosque]/[campaign].
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

export default async function KioskPage({ params }: PageProps) {
  const { mosque: slug } = await params;

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, description, city, country')
    .eq('slug', slug)
    .eq('donations_active', true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select<string, CampaignRow>('id, slug, title, description, goal_amount, cause_type, icon')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  const campaignList = campaigns ?? [];

  // Compute raised totals via admin client (donor-PII tables have no public RLS).
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

  const enriched: KioskCampaign[] = campaignList.map((c) => ({
    ...c,
    raised_cents: raisedMap.get(c.id) ?? 0,
  }));

  return (
    <KioskDisplayClient
      orgSlug={organization.slug}
      orgName={organization.name}
      orgCity={organization.city}
      orgCountry={organization.country}
      orgDescription={organization.description}
      campaigns={enriched}
    />
  );
}
