import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('mosqueAdmin.dashboard');
  const tRoot = await getTranslations('mosqueAdmin');

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
  // Finance-related queries only run if donations are active (onboarding complete).
  const donationsActive = organization.donations_active;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [totalResult, monthResult, campaignsResult, productsResult, offeringsResult, recentResult] = await Promise.all([
    donationsActive
      ? supabaseAdmin
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('stats_extra3', organization.id)
          .eq('status', 'PAID')
      : Promise.resolve({ data: [], count: 0 }),
    donationsActive
      ? supabaseAdmin
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('stats_extra3', organization.id)
          .eq('status', 'PAID')
          .gte('paid_at', monthStart.toISOString())
      : Promise.resolve({ data: [], count: 0 }),
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('appointment_offerings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('is_active', true),
    donationsActive
      ? supabaseAdmin
          .from('transactions')
          .select<string, TransactionRow>(
            'id, paynl_order_id, amount, status, donor_name, created_at, paid_at',
          )
          .eq('stats_extra3', organization.id)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const totalPaidCents = ((totalResult.data as Array<{ amount: number }>) || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0,
  );
  const monthPaidCents = ((monthResult.data as Array<{ amount: number }>) || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0,
  );
  const activeCampaigns = campaignsResult.count ?? 0;
  const activeProducts = productsResult.count ?? 0;
  const activeAppointmentOfferings = offeringsResult.count ?? 0;
  const recentTransactions: TransactionRow[] = (recentResult.data as TransactionRow[]) || [];

  return (
    <div className="mx-auto max-w-5xl py-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {tRoot('prefix')}
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
              {t('kycBadge', { status: t(`kycStatus.${organization.kyc_status}`) })}
            </Badge>
            {organization.donations_active ? (
              <Badge variant="default">{t('donationsActive')}</Badge>
            ) : (
              <Badge variant="outline">{t('donationsInactive')}</Badge>
            )}
            <Link
              href={`/mosque-admin/${organization.slug}/settings`}
              className="mt-2 text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
            >
              {t('settingsLink')}
            </Link>
          </div>
        </div>

        {/* Onboarding CTA — shown when donations are not yet active */}
        {!donationsActive && (
          <Card className="mb-8 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium">{t('onboardingTitle')}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t('onboardingDescription')}
                </p>
              </div>
              <Link
                href={`/mosque-admin/${organization.slug}/settings`}
                className="shrink-0 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
              >
                {t('onboardingCta')}
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {donationsActive && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>{t('totalRaised')}</CardDescription>
                  <CardTitle className="text-3xl">{formatEuro(totalPaidCents)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('totalRaisedCaption', { count: (totalResult as { count?: number }).count ?? 0 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>{t('thisMonth')}</CardDescription>
                  <CardTitle className="text-3xl">{formatEuro(monthPaidCents)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('thisMonthCaption', { count: (monthResult as { count?: number }).count ?? 0 })}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('activeCampaigns')}</CardDescription>
              <CardTitle className="text-3xl">{activeCampaigns}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('activeCampaignsCaption')}
              </p>
              <Link
                href={`/mosque-admin/${organization.slug}/campaigns`}
                className="mt-2 inline-block text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                {t('manageCampaigns')}
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('activeProducts')}</CardDescription>
              <CardTitle className="text-3xl">{activeProducts}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('activeProductsCaption')}
              </p>
              <Link
                href={`/mosque-admin/${organization.slug}/products`}
                className="mt-2 inline-block text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                {t('manageProducts')}
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('activeAppointmentOfferings')}</CardDescription>
              <CardTitle className="text-3xl">{activeAppointmentOfferings}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('activeAppointmentOfferingsCaption')}
              </p>
              <Link
                href={`/mosque-admin/${organization.slug}/appointments`}
                className="mt-2 inline-block text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                {t('manageAppointments')}
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Finance sections — only visible after onboarding */}
        {donationsActive && (
          <>
            <Separator className="my-8" />

            {/* Pay.nl routing status */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">{t('paynlRoutingTitle')}</CardTitle>
                <CardDescription>
                  {t('paynlRoutingDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {organization.paynl_service_id ? (
                  <>
                    <p>
                      <span className="text-slate-500 dark:text-slate-400">{t('serviceIdLabel')}</span>{' '}
                      <code>{organization.paynl_service_id}</code>
                    </p>
                    {organization.paynl_merchant_id && (
                      <p>
                        <span className="text-slate-500 dark:text-slate-400">{t('merchantIdLabel')}</span>{' '}
                        <code>{organization.paynl_merchant_id}</code>
                      </p>
                    )}
                    <p>
                      <span className="text-slate-500 dark:text-slate-400">{t('platformFeeLabel')}</span>{' '}
                      {(organization.platform_fee_bps / 100).toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-300">
                    {t('paynlFallbackMessage')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent transactions */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{t('recentDonationsTitle')}</CardTitle>
                    <CardDescription>{t('recentDonationsDescription')}</CardDescription>
                  </div>
                  <Link
                    href={`/mosque-admin/${organization.slug}/transactions`}
                    className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
                  >
                    {t('viewAll')}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('noDonationsYet')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="pb-2 pr-4">{t('tableOrder')}</th>
                          <th className="pb-2 pr-4">{t('tableDonor')}</th>
                          <th className="pb-2 pr-4">{t('tableAmount')}</th>
                          <th className="pb-2 pr-4">{t('tableStatus')}</th>
                          <th className="pb-2">{t('tableDate')}</th>
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
                                {t(`txStatus.${tx.status}`)}
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
          </>
        )}
    </div>
  );
}
