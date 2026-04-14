import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOrgAdmin } from '@/lib/api-auth';
import {
  getMerchant,
  isAllianceEnabled,
  PayNLAllianceNotActivatedError,
  PayNLError,
} from '@/lib/paynl-alliance';

/**
 * GET /api/organizations/[id]/merchant/status
 *
 * Fetches the current merchant status from Pay.nl and syncs it to the
 * organization row. This is the polling endpoint that the onboarding UI
 * calls to check whether KYC has been approved.
 *
 * Auth: org admin or platform superadmin.
 *
 * If the org has no paynl_merchant_id yet, returns the local kyc_status
 * without calling Pay.nl (the org hasn't been submitted yet).
 *
 * When KYC transitions to 'approved', this endpoint automatically:
 *   - sets donations_active = true
 *   - sets onboarded_at = now()
 *
 * When KYC transitions to 'rejected', donations_active stays false.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  }

  // ---- 1. Auth: org admin or superadmin -----------------------------------
  const auth = await requireOrgAdmin(id, ['admin']);
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // ---- 2. Fetch the org's current merchant fields -------------------------
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, paynl_merchant_id, paynl_service_id, kyc_status, donations_active, onboarded_at, platform_fee_bps',
    )
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // If no merchant_id, the org hasn't submitted KYC yet — return local state.
  if (!org.paynl_merchant_id) {
    return NextResponse.json({
      merchantId: null,
      serviceId: org.paynl_service_id || null,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      walletBalance: null,
      source: 'local',
    });
  }

  // ---- 3. Sync from Pay.nl if Alliance is enabled -------------------------
  if (!isAllianceEnabled()) {
    // Alliance not enabled but we have a merchant_id (maybe set manually by superadmin).
    return NextResponse.json({
      merchantId: org.paynl_merchant_id,
      serviceId: org.paynl_service_id,
      kycStatus: org.kyc_status,
      donationsActive: org.donations_active,
      onboardedAt: org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      walletBalance: null,
      source: 'local',
    });
  }

  try {
    const merchant = await getMerchant(org.paynl_merchant_id);

    // ---- 4. Detect KYC status changes and update locally ------------------
    const update: Record<string, unknown> = {};
    let kycChanged = false;

    if (merchant.kycStatus !== org.kyc_status) {
      update.kyc_status = merchant.kycStatus;
      kycChanged = true;
    }

    // Auto-activate donations when approved (one-way latch).
    if (merchant.kycStatus === 'approved' && !org.donations_active) {
      update.donations_active = true;
      update.onboarded_at = new Date().toISOString();
    }

    // If KYC was revoked/rejected after being approved, deactivate.
    if (merchant.kycStatus === 'rejected' && org.donations_active) {
      update.donations_active = false;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update(update)
        .eq('id', id);

      if (updateError) {
        console.error('[Alliance] Failed to sync merchant status', {
          organizationId: id,
          merchantId: org.paynl_merchant_id,
          error: updateError.message,
        });
      } else if (kycChanged) {
        console.log('[Alliance] KYC status synced', {
          organizationId: id,
          merchantId: org.paynl_merchant_id,
          from: org.kyc_status,
          to: merchant.kycStatus,
        });
      }
    }

    return NextResponse.json({
      merchantId: merchant.merchantId,
      serviceId: merchant.serviceId,
      kycStatus: merchant.kycStatus,
      isActive: merchant.isActive,
      donationsActive: merchant.kycStatus === 'approved' ? true : org.donations_active,
      onboardedAt:
        merchant.kycStatus === 'approved' && !org.onboarded_at
          ? new Date().toISOString()
          : org.onboarded_at,
      platformFeeBps: org.platform_fee_bps,
      walletBalance: merchant.walletBalance || null,
      legalName: merchant.legalName,
      tradingName: merchant.tradingName,
      source: 'paynl',
    });
  } catch (error) {
    if (error instanceof PayNLAllianceNotActivatedError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PayNLError) {
      console.error('[Alliance] getMerchant failed', {
        organizationId: id,
        merchantId: org.paynl_merchant_id,
        status: error.status,
        body: error.body,
      });
      // Fall back to local data on Pay.nl errors so the UI doesn't break.
      return NextResponse.json({
        merchantId: org.paynl_merchant_id,
        serviceId: org.paynl_service_id,
        kycStatus: org.kyc_status,
        donationsActive: org.donations_active,
        onboardedAt: org.onboarded_at,
        platformFeeBps: org.platform_fee_bps,
        walletBalance: null,
        source: 'local-fallback',
        warning: 'Could not reach Pay.nl — showing cached status.',
      });
    }
    console.error('[Alliance] Unexpected error in merchant/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
