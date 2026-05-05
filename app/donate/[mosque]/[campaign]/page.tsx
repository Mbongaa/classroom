import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DonationCheckout } from './DonationCheckout';

/**
 * /donate/[mosque]/[campaign]
 *
 * Public donation page (Stripe-style checkout). Uses the anon Supabase
 * client (public RLS on campaigns); no donor PII is read here.
 *
 * The `mosque` route param is the organization slug.
 */

interface PageProps {
  params: Promise<{
    mosque: string;
    campaign: string;
  }>;
  searchParams: Promise<{ recurring?: string }>;
}

interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
  organization_id: string;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
}

export default async function DonationPage({ params, searchParams }: PageProps) {
  const { mosque, campaign: campaignSlug } = await params;
  const { recurring } = await searchParams;

  // Recurring donations use the dedicated mandate registration page.
  if (recurring === 'true') {
    redirect(`/donate/${mosque}/${campaignSlug}/mandate`);
  }

  const supabase = await createClient();

  // Resolve the org first — campaign slugs are unique per organization,
  // so we need org.id to disambiguate the campaign lookup.
  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, name, slug')
    .eq('slug', mosque)
    .eq('donations_active', true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, title, description, goal_amount, cause_type, icon, organization_id')
    .eq('organization_id', organization.id)
    .eq('slug', campaignSlug)
    .eq('is_active', true)
    .single<CampaignRow>();

  if (!campaign) {
    notFound();
  }

  // Compute raised amount for progress bar (admin client — transactions have no public RLS).
  let raisedCents = 0;
  if (campaign.goal_amount && campaign.goal_amount > 0) {
    const supabaseAdmin = createAdminClient();
    const [txResult, ddResult] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('campaign_id', campaign.id)
        .eq('status', 'PAID'),
      supabaseAdmin
        .from('direct_debits')
        .select('amount, mandates!inner(campaign_id)')
        .eq('mandates.campaign_id', campaign.id)
        .eq('status', 'COLLECTED'),
    ]);
    for (const row of txResult.data ?? []) {
      raisedCents += row.amount ?? 0;
    }
    for (const row of ddResult.data ?? []) {
      raisedCents += row.amount ?? 0;
    }
  }

  return (
    <DonationCheckout
      campaign={{
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        goal_amount: campaign.goal_amount,
        cause_type: campaign.cause_type,
        icon: campaign.icon,
        raised_cents: raisedCents,
      }}
      orgName={organization.name}
      orgSlug={organization.slug}
      isRecurring={recurring === 'true'}
    />
  );
}
