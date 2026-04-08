import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DonationForm } from './DonationForm';

/**
 * /donate/[mosque]/[campaign]
 *
 * Public donation page. Uses the anon Supabase client (with the
 * "Public can view active campaigns" RLS policy on campaigns); no donor PII
 * is ever read here. The `mosque` route param is the user-facing label (the
 * organization slug) — the underlying tenant entity is `organizations`.
 */

interface PageProps {
  params: Promise<{
    mosque: string;
    campaign: string;
  }>;
}

interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  organization_id: string;
}

export default async function DonationPage({ params }: PageProps) {
  const { mosque, campaign: campaignSlug } = await params;

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, title, description, goal_amount, cause_type, organization_id')
    .eq('slug', campaignSlug)
    .eq('is_active', true)
    .single<CampaignRow>();

  if (!campaign) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {mosque}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{campaign.title}</h1>
          {campaign.description && (
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              {campaign.description}
            </p>
          )}
        </div>
        <DonationForm campaign={campaign} mosqueSlug={mosque} />
      </div>
    </main>
  );
}
