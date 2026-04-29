import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidManageTokenShape } from '@/lib/donor-manage-token';
import { ManageMandateClient } from './ManageMandateClient';

/**
 * /donate/manage/[token]
 *
 * Public donor self-service. The token in the URL is the only credential —
 * possession of the donor's email = ability to view/edit/cancel. We use the
 * admin client because the row's RLS doesn't include donor-scoped policies
 * (donors aren't logged-in users).
 */

interface PageProps {
  params: Promise<{ token: string }>;
}

interface MandateRow {
  id: string;
  status: string;
  monthly_amount: number | null;
  donor_name: string;
  donor_email: string;
  iban_owner: string;
  paynl_mandate_id: string;
  first_debit_at: string | null;
  next_debit_at: string | null;
  created_at: string;
  campaigns: {
    id: string;
    title: string;
    slug: string;
    icon: string | null;
    organizations: { id: string; name: string; slug: string };
  };
}

export default async function ManageMandatePage({ params }: PageProps) {
  const { token } = await params;
  if (!isValidManageTokenShape(token)) notFound();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('mandates')
    .select(
      'id, status, monthly_amount, donor_name, donor_email, iban_owner, paynl_mandate_id, first_debit_at, next_debit_at, created_at, campaigns!inner(id, title, slug, icon, organizations!inner(id, name, slug))',
    )
    .eq('manage_token', token)
    .single<MandateRow>();

  if (!data) notFound();

  // Show the page even for CANCELLED mandates so the donor sees a clear
  // "this is cancelled" state instead of a confusing 404. Editing UI is
  // disabled in that branch.
  return (
    <ManageMandateClient
      token={token}
      initial={{
        status: data.status,
        donorName: data.donor_name,
        donorEmail: data.donor_email,
        ibanOwner: data.iban_owner,
        monthlyAmount: data.monthly_amount,
        paynlMandateId: data.paynl_mandate_id,
        firstDebitAt: data.first_debit_at,
        nextDebitAt: data.next_debit_at,
        createdAt: data.created_at,
        campaign: {
          id: data.campaigns.id,
          title: data.campaigns.title,
          icon: data.campaigns.icon,
        },
        organization: {
          id: data.campaigns.organizations.id,
          name: data.campaigns.organizations.name,
          slug: data.campaigns.organizations.slug,
        },
      }}
    />
  );
}
