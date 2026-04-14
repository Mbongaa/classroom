import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MembersClient, type MemberRow } from './MembersClient';

/**
 * /mosque-admin/[slug]/members
 *
 * Recurring donor list. One row per SEPA mandate that belongs to a campaign
 * owned by this organization. Phase 2 of the finance dashboard build.
 *
 * What we compute server-side per mandate:
 *   - total_collected_cents — sum of direct_debits with status='COLLECTED'
 *   - last_collected_at     — most recent collected debit
 *   - total_debits          — count of all direct_debits attached
 *   - storno_count          — count of direct_debits with status='STORNO'
 *   - recent_storno_flag    — TRUE when 2+ of the most recent 3 debits
 *                              (ordered by process_date desc) are STORNO.
 *                              Signals "donor probably has no money,
 *                              candidate for cancellation".
 *
 * Auth: anyone in the org can view; only admins (and superadmins) can
 * cancel. The cancel button is wired to POST /api/organizations/[id]/
 * mandates/[mandateId]/cancel.
 *
 * Why we fetch via the admin client: mandates are RLS-locked (donor PII,
 * service-role only), so we authenticate the user with the user-scoped
 * client and then drop to the admin client to read mandate rows. The
 * org-membership check above the fetch is the gate.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
}

interface MandateDbRow {
  id: string;
  paynl_mandate_id: string;
  mandate_type: string;
  donor_name: string;
  donor_email: string | null;
  iban_owner: string;
  status: string;
  monthly_amount: number | null;
  first_debit_at: string | null;
  created_at: string;
  campaign_id: string | null;
  campaigns: { id: string; title: string; slug: string; organization_id: string } | null;
}

interface DirectDebitDbRow {
  id: string;
  mandate_id: string;
  amount: number;
  status: string;
  process_date: string | null;
  collected_at: string | null;
  storno_at: string | null;
  created_at: string;
}

export default async function MembersPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}/members`);
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

  const canCancel = userRole === 'admin' || userRole === 'superadmin';

  // ---------------------------------------------------------------------
  // Fetch all mandates for campaigns owned by this org.
  //
  // Supabase doesn't support filtering by joined-table columns directly in
  // a single .select() call without a foreign-table filter, so we go in
  // two steps: list the org's campaign ids first, then fetch mandates by
  // campaign_id IN (...).
  // ---------------------------------------------------------------------
  const { data: orgCampaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('organization_id', organization.id);

  const campaignIds = (orgCampaigns ?? []).map((c) => c.id);

  let mandates: MandateDbRow[] = [];
  let directDebits: DirectDebitDbRow[] = [];

  if (campaignIds.length > 0) {
    const { data: mandateRows } = await supabaseAdmin
      .from('mandates')
      .select<string, MandateDbRow>(
        `id,
         paynl_mandate_id,
         mandate_type,
         donor_name,
         donor_email,
         iban_owner,
         status,
         monthly_amount,
         first_debit_at,
         created_at,
         campaign_id,
         campaigns!inner(id, title, slug, organization_id)`,
      )
      .in('campaign_id', campaignIds)
      .order('created_at', { ascending: false });

    mandates = mandateRows ?? [];

    if (mandates.length > 0) {
      const mandateIds = mandates.map((m) => m.id);
      const { data: debitRows } = await supabaseAdmin
        .from('direct_debits')
        .select<string, DirectDebitDbRow>(
          'id, mandate_id, amount, status, process_date, collected_at, storno_at, created_at',
        )
        .in('mandate_id', mandateIds);
      directDebits = debitRows ?? [];
    }
  }

  // -------------------------------------------------------------------
  // Aggregate per mandate. We sort the debits by process_date (falling
  // back to created_at) so the "recent storno flag" looks at the actual
  // most recent attempts, not the order rows were inserted.
  // -------------------------------------------------------------------
  const debitsByMandate = new Map<string, DirectDebitDbRow[]>();
  for (const debit of directDebits) {
    const list = debitsByMandate.get(debit.mandate_id) ?? [];
    list.push(debit);
    debitsByMandate.set(debit.mandate_id, list);
  }

  function debitDate(d: DirectDebitDbRow): number {
    return new Date(d.process_date || d.created_at).getTime();
  }

  const memberRows: MemberRow[] = mandates.map((m) => {
    const debits = (debitsByMandate.get(m.id) ?? []).slice().sort((a, b) => debitDate(b) - debitDate(a));

    let totalCollectedCents = 0;
    let lastCollectedAt: string | null = null;
    let stornoCount = 0;

    for (const d of debits) {
      if (d.status === 'COLLECTED') {
        totalCollectedCents += d.amount;
        const ts = d.collected_at || d.process_date || d.created_at;
        if (!lastCollectedAt || new Date(ts).getTime() > new Date(lastCollectedAt).getTime()) {
          lastCollectedAt = ts;
        }
      }
      if (d.status === 'STORNO') {
        stornoCount += 1;
      }
    }

    // "At-risk" heuristic: 2+ stornos among the 3 most recent debits.
    // Catches donors whose recent attempts are bouncing without flagging
    // long-time donors who had a single one-off failure years ago.
    const recentThree = debits.slice(0, 3);
    const recentStornos = recentThree.filter((d) => d.status === 'STORNO').length;
    const recentStornoFlag = recentThree.length >= 2 && recentStornos >= 2;

    return {
      id: m.id,
      paynl_mandate_id: m.paynl_mandate_id,
      mandate_type: m.mandate_type,
      donor_name: m.donor_name,
      donor_email: m.donor_email,
      iban_owner: m.iban_owner,
      status: m.status,
      monthly_amount: m.monthly_amount,
      first_debit_at: m.first_debit_at,
      created_at: m.created_at,
      campaign: m.campaigns
        ? { id: m.campaigns.id, title: m.campaigns.title, slug: m.campaigns.slug }
        : null,
      total_debits: debits.length,
      total_collected_cents: totalCollectedCents,
      last_collected_at: lastCollectedAt,
      storno_count: stornoCount,
      recent_storno_flag: recentStornoFlag,
    };
  });

  return (
    <div className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Mosque admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">Members</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {organization.name} — recurring donors with active SEPA mandates
          </p>
        </div>
        <Link
          href={`/mosque-admin/${organization.slug}`}
          className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          ← Back to dashboard
        </Link>
      </div>

      <MembersClient
        organizationId={organization.id}
        members={memberRows}
        canCancel={canCancel}
      />
    </div>
  );
}
