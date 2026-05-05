import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MandateRegistration } from '../[campaign]/mandate/MandateRegistration';

/**
 * /donate/[mosque]/member
 *
 * Public membership-mandate page. Sets up a recurring SEPA mandate that is
 * NOT tied to a campaign — it's an org-level monthly contribution.
 *
 * Reuses the existing MandateRegistration component (campaign omitted).
 */

interface PageProps {
  params: Promise<{ mosque: string }>;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
}

export default async function MembershipPage({ params }: PageProps) {
  const { mosque } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, name, slug')
    .eq('slug', mosque)
    .eq('donations_active', true)
    .single();

  if (!organization) {
    notFound();
  }

  return (
    <MandateRegistration
      organizationId={organization.id}
      orgName={organization.name}
      orgSlug={organization.slug}
    />
  );
}
