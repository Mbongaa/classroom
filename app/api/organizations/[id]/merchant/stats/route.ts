import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import { isAllianceEnabled } from '@/lib/paynl-alliance';

/**
 * GET /api/organizations/[id]/merchant/stats
 *
 * Returns donation statistics for a merchant. Combines local DB aggregates
 * with Pay.nl Alliance merchant stats (wallet balance, etc.) when available.
 *
 * Query params:
 *   - from: ISO date (default: 30 days ago)
 *   - to: ISO date (default: today)
 *   - groupBy: 'day' | 'week' | 'month' (default: 'day')
 *
 * Auth: org admin or superadmin.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const searchParams = request.nextUrl.searchParams;

  // Date range defaults: last 30 days.
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const from = searchParams.get('from') || thirtyDaysAgo.toISOString().slice(0, 10);
  const to = searchParams.get('to') || now.toISOString().slice(0, 10);
  const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month';

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from and to must be ISO dates (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // ---- 1. Local DB aggregates ---------------------------------------------
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('paynl_merchant_id, platform_fee_bps, donations_active')
    .eq('id', id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Fetch campaign IDs for this org.
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('organization_id', id);

  const campaignIds = (campaigns ?? []).map((c) => c.id);

  // Local transaction stats.
  let totalDonationsCents = 0;
  let totalPaidCount = 0;
  let totalPendingCount = 0;
  let totalMandates = 0;
  let activeMandates = 0;

  if (campaignIds.length > 0) {
    const [paidResult, pendingResult, mandateResult, activeMandateResult] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('amount', { count: 'exact' })
        .in('campaign_id', campaignIds)
        .eq('status', 'PAID')
        .gte('paid_at', `${from}T00:00:00Z`)
        .lte('paid_at', `${to}T23:59:59Z`),
      supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('mandates')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds),
      supabaseAdmin
        .from('mandates')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .eq('status', 'ACTIVE'),
    ]);

    totalDonationsCents = (paidResult.data || []).reduce(
      (sum, row) => sum + ((row as { amount: number }).amount || 0),
      0,
    );
    totalPaidCount = paidResult.count ?? 0;
    totalPendingCount = pendingResult.count ?? 0;
    totalMandates = mandateResult.count ?? 0;
    activeMandates = activeMandateResult.count ?? 0;
  }

  const estimatedFeesCents = Math.round(
    (totalDonationsCents * (org.platform_fee_bps || 200)) / 10_000,
  );

  // ---- 2. Pay.nl Alliance stats ---------------------------------------
  // Wallet balance + aggregated stats need dedicated v2 endpoints that are
  // not part of the merchant onboarding surface. Local DB aggregates cover
  // donation counts + totals for now; wallet/remote stats are pending the
  // v2 port.
  const walletBalance = null;
  const paynlStats = null;
  if (isAllianceEnabled() && org.paynl_merchant_id) {
    // No-op: v2 endpoints for wallet + stats not yet wired.
  }

  return NextResponse.json({
    organizationId: id,
    period: { from, to, groupBy },
    local: {
      totalDonationsCents,
      totalPaidCount,
      totalPendingCount,
      totalMandates,
      activeMandates,
      estimatedFeesCents,
      platformFeeBps: org.platform_fee_bps,
    },
    walletBalance,
    paynlStats,
  });
}
