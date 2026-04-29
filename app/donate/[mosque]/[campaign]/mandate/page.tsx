import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MandateRegistration } from './MandateRegistration';

/**
 * /donate/[mosque]/[campaign]/mandate
 *
 * Public SEPA Direct Debit mandate registration page. Donors fill in their
 * bank details (IBAN + BIC) and sign a SEPA mandate authorising the mosque
 * to collect monthly donations via Pay.nl.
 *
 * No authentication required — mirrors the one-time donation page pattern.
 * Campaign + org data is fetched server-side; the interactive form is a
 * client component.
 */

interface PageProps {
  params: Promise<{
    mosque: string;
    campaign: string;
  }>;
  searchParams: Promise<{ kiosk?: string }>;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MandatePage({ params, searchParams }: PageProps) {
  const { mosque, campaign: campaignSlug } = await params;
  const { kiosk: kioskSessionId } = await searchParams;

  // If opened via QR scan from kiosk, mark the session as scanned.
  if (kioskSessionId && UUID_RE.test(kioskSessionId)) {
    const adminClient = createAdminClient();
    adminClient
      .from('kiosk_sessions')
      .update({ status: 'scanned' })
      .eq('id', kioskSessionId)
      .eq('status', 'waiting')
      .then(({ error }) => {
        if (error) console.error('[KioskSession] scanned update failed', error);
      });
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
    <MandateRegistration
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
    />
  );
}
