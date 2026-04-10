import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * /mosque-admin/[slug]
 *
 * Phase 2 foundation dashboard for organization admins. Shows:
 *   - Organization profile (name, KYC status, Pay.nl status)
 *   - Total donations (all-time + this month)
 *   - Active campaigns count
 *   - Recent transactions (last 10)
 *
 * Gated by: the user must be a member of this organization (any role) OR a
 * platform superadmin. Redirects to /login when unauthenticated.
 *
 * The route is still called `/mosque-admin/[slug]` for the user-facing label,
 * but the underlying tenant entity is `organizations` — there is no longer a
 * separate `mosques` table. See migration 20260408_03 for the consolidation.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  donations_active: boolean;
  paynl_service_id: string | null;
  paynl_merchant_id: string | null;
  platform_fee_bps: number;
  created_at: string;
}

interface TransactionRow {
  id: string;
  paynl_order_id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCEL' | 'EXPIRED';
  donor_name: string | null;
  created_at: string;
  paid_at: string | null;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function kycBadgeVariant(
  status: OrganizationRow['kyc_status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'submitted':
      return 'secondary';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default async function MosqueAdminDashboard({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Require authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/mosque-admin/${slug}`);
  }

  // Resolve organization by slug. We use the admin client because the
  // existing organizations RLS only exposes the user's primary org via
  // profiles.organization_id, which doesn't cover users who belong to
  // multiple orgs via organization_members.
  const supabaseAdmin = createAdminClient();
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select<string, OrganizationRow>(
      'id, slug, name, description, city, country, kyc_status, donations_active, paynl_service_id, paynl_merchant_id, platform_fee_bps, created_at',
    )
    .eq('slug', slug)
    .single();

  if (!organization) {
    notFound();
  }

  // Membership check (defense in depth on top of RLS).
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

  // Aggregates — admin client so superadmins and members see the same numbers.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [totalResult, monthResult, campaignsResult, recentResult] = await Promise.all([
    supabaseAdmin
      .from('transactions')
      .select('amount', { count: 'exact' })
      .eq('stats_extra3', organization.id)
      .eq('status', 'PAID'),
    supabaseAdmin
      .from('transactions')
      .select('amount', { count: 'exact' })
      .eq('stats_extra3', organization.id)
      .eq('status', 'PAID')
      .gte('paid_at', monthStart.toISOString()),
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('transactions')
      .select<string, TransactionRow>(
        'id, paynl_order_id, amount, status, donor_name, created_at, paid_at',
      )
      .eq('stats_extra3', organization.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalPaidCents = (totalResult.data || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0,
  );
  const monthPaidCents = (monthResult.data || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0,
  );
  const activeCampaigns = campaignsResult.count ?? 0;
  const recentTransactions: TransactionRow[] = recentResult.data || [];

  return (
    <div className="mx-auto max-w-5xl py-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mosque admin
            </p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">{organization.name}</h1>
            {organization.city && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {organization.city}, {organization.country}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={kycBadgeVariant(organization.kyc_status)}>
              KYC: {organization.kyc_status}
            </Badge>
            {organization.donations_active ? (
              <Badge variant="default">Donations active</Badge>
            ) : (
              <Badge variant="outline">Donations inactive</Badge>
            )}
            <Link
              href={`/mosque-admin/${organization.slug}/settings`}
              className="mt-2 text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
            >
              Settings →
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total raised</CardDescription>
              <CardTitle className="text-3xl">{formatEuro(totalPaidCents)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalResult.count ?? 0} paid donations
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This month</CardDescription>
              <CardTitle className="text-3xl">{formatEuro(monthPaidCents)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {monthResult.count ?? 0} donations this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active campaigns</CardDescription>
              <CardTitle className="text-3xl">{activeCampaigns}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visible on the donation page
              </p>
              <Link
                href={`/mosque-admin/${organization.slug}/campaigns`}
                className="mt-2 inline-block text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                Manage campaigns →
              </Link>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Pay.nl routing status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Pay.nl routing</CardTitle>
            <CardDescription>
              Where donations currently flow for this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {organization.paynl_service_id ? (
              <>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Service ID:</span>{' '}
                  <code>{organization.paynl_service_id}</code>
                </p>
                {organization.paynl_merchant_id && (
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">Merchant ID:</span>{' '}
                    <code>{organization.paynl_merchant_id}</code>
                  </p>
                )}
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Platform fee:</span>{' '}
                  {(organization.platform_fee_bps / 100).toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-slate-600 dark:text-slate-300">
                Using platform-wide Pay.nl fallback. Alliance sub-merchant
                onboarding will assign a dedicated sales location here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Recent donations</CardTitle>
                <CardDescription>Last 10 transactions for this organization</CardDescription>
              </div>
              <Link
                href={`/mosque-admin/${organization.slug}/transactions`}
                className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No donations yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="pb-2 pr-4">Order</th>
                      <th className="pb-2 pr-4">Donor</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0"
                      >
                        <td className="py-3 pr-4">
                          <code className="text-xs">{tx.paynl_order_id}</code>
                        </td>
                        <td className="py-3 pr-4">{tx.donor_name || '—'}</td>
                        <td className="py-3 pr-4 font-medium">{formatEuro(tx.amount)}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              tx.status === 'PAID'
                                ? 'default'
                                : tx.status === 'PENDING'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(tx.paid_at || tx.created_at).toLocaleDateString('nl-NL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
