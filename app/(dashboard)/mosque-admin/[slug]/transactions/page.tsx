import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TransactionsClient, type UnifiedTransaction } from './TransactionsClient';

/**
 * /mosque-admin/[slug]/transactions
 *
 * Unified ledger of every donation that has ever flowed through this org —
 * one-time orders AND individual SEPA debits — in one date-sorted list.
 *
 * Why we merge in JS instead of a SQL UNION view: the two source tables
 * have different shapes (transactions has donor PII columns, direct_debits
 * doesn't and has to be joined through mandates for donor identity). A
 * view would obscure that. Doing it here keeps the data flow legible and
 * the materialized rows fit comfortably in memory at the scale we expect
 * (low thousands per org for years).
 *
 * Phase 2 budget: fetch up to 500 of each kind. The client paginates the
 * merged list. If/when an org pushes past that, we'll add a date-range
 * filter at the SQL layer or move to keyset pagination.
 */

const FETCH_LIMIT = 500;

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  donations_active: boolean;
}

interface TransactionDbRow {
  id: string;
  paynl_order_id: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  is_test: boolean;
  created_at: string;
  paid_at: string | null;
  campaign_id: string | null;
  campaigns: { id: string; title: string; slug: string; organization_id: string } | null;
}

interface DirectDebitDbRow {
  id: string;
  paynl_directdebit_id: string;
  paynl_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  process_date: string | null;
  storno_at: string | null;
  collected_at: string | null;
  created_at: string;
  mandate_id: string;
  mandates: {
    id: string;
    paynl_mandate_id: string;
    donor_name: string;
    donor_email: string | null;
    campaign_id: string | null;
    campaigns: { id: string; title: string; slug: string; organization_id: string } | null;
  } | null;
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function TransactionsPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const t = await getTranslations('mosqueAdmin.transactions');
  const tRoot = await getTranslations('mosqueAdmin');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}/transactions`);
  }

  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, donations_active')
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Gate: transactions are only visible after merchant onboarding is complete.
  if (!organization.donations_active) {
    redirect(`/mosque-admin/${slug}/settings`);
  }

  // Membership check.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();
  const isSuperadmin = profile?.is_superadmin === true;

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
  }

  // ---------------------------------------------------------------------
  // Find this org's campaign ids first — we use them to filter both
  // transactions and direct_debits in a single .in() each.
  // ---------------------------------------------------------------------
  const { data: orgCampaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('organization_id', organization.id);

  const campaignIds = (orgCampaigns ?? []).map((c) => c.id);

  let transactions: TransactionDbRow[] = [];
  let directDebits: DirectDebitDbRow[] = [];

  if (campaignIds.length > 0) {
    const [txResult, ddResult] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select<string, TransactionDbRow>(
          `id, paynl_order_id, amount, currency, payment_method, status,
           donor_name, donor_email, is_test, created_at, paid_at, campaign_id,
           campaigns!inner(id, title, slug, organization_id)`,
        )
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT),
      supabaseAdmin
        .from('direct_debits')
        .select<string, DirectDebitDbRow>(
          `id, paynl_directdebit_id, paynl_order_id, amount, currency, status,
           process_date, storno_at, collected_at, created_at, mandate_id,
           mandates!inner(id, paynl_mandate_id, donor_name, donor_email, campaign_id,
             campaigns!inner(id, title, slug, organization_id))`,
        )
        .in('mandates.campaign_id', campaignIds)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT),
    ]);

    transactions = txResult.data ?? [];
    directDebits = ddResult.data ?? [];
  }

  // ---------------------------------------------------------------------
  // Normalize both into a unified shape, then sort by the most relevant
  // date (paid_at when present, else created_at) descending.
  // ---------------------------------------------------------------------
  const unified: UnifiedTransaction[] = [];

  for (const t of transactions) {
    const campaign = pickRelation(t.campaigns);
    unified.push({
      id: `tx-${t.id}`,
      kind: 'one-time',
      reference: t.paynl_order_id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      donor_name: t.donor_name,
      donor_email: t.donor_email,
      payment_method: t.payment_method,
      campaign_title: campaign?.title ?? null,
      campaign_slug: campaign?.slug ?? null,
      sort_date: t.paid_at || t.created_at,
      created_at: t.created_at,
      is_test: t.is_test,
    });
  }

  for (const d of directDebits) {
    const mandate = pickRelation(d.mandates);
    const campaign = pickRelation(mandate?.campaigns);
    unified.push({
      id: `dd-${d.id}`,
      kind: 'recurring',
      reference: d.paynl_directdebit_id,
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      donor_name: mandate?.donor_name ?? null,
      donor_email: mandate?.donor_email ?? null,
      payment_method: 'sepa',
      campaign_title: campaign?.title ?? null,
      campaign_slug: campaign?.slug ?? null,
      sort_date: d.collected_at || d.process_date || d.created_at,
      created_at: d.created_at,
      is_test: false,
    });
  }

  unified.sort(
    (a, b) => new Date(b.sort_date).getTime() - new Date(a.sort_date).getTime(),
  );

  return (
    <div className="mx-auto max-w-6xl py-6">
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

      <TransactionsClient transactions={unified} />
    </div>
  );
}
