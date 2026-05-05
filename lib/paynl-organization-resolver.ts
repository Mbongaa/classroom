/**
 * Per-organization Pay.nl sales location resolver.
 *
 * Phase 1 used a single `PAYNL_SERVICE_ID` env var for every donation.
 * Phase 2 introduces per-organization `SL-XXXX-XXXX` values stored on the
 * organizations table (populated by Alliance `createMerchant` calls).
 *
 * This helper resolves the right identifier to use for a given campaign:
 *
 *   1. If the campaign's organization has `paynl_service_id` set AND
 *      `donations_active = true` → use it (Phase 2 multi-tenant routing)
 *   2. Otherwise fall back to `PAYNL_SERVICE_ID` only in sandbox/local
 *      or when PAYNL_ALLOW_PLATFORM_FALLBACK=true.
 *
 * When Alliance is fully rolled out to every organization, the fallback can
 * be removed and the env var retired.
 */

import type { createAdminClient } from './supabase/admin';
import { shouldAllowPlatformPayNLFallback } from './paynl-production';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ResolvedOrganizationServiceId {
  /** The SL-XXXX-XXXX to pass to Pay.nl order/mandate create calls. */
  serviceId: string;
  /** The organization row id the campaign belongs to (for stats/logging). */
  organizationId: string;
  /** The Pay.nl Alliance merchant id if the organization has been onboarded. */
  merchantId: string | null;
  /** True when we used the env var fallback (= legacy Phase 1 routing). */
  usedFallback: boolean;
}

/**
 * Look up the Pay.nl sales location that should receive a donation for a
 * given campaign.
 *
 * Returns null if:
 *   - the campaign doesn't exist,
 *   - the campaign is inactive,
 *   - the campaign's organization exists but has no service id AND no env fallback.
 */
export async function resolveOrganizationServiceIdForCampaign(
  supabase: AdminClient,
  campaignId: string,
): Promise<ResolvedOrganizationServiceId | null> {
  // Load the campaign + its organization in a single round trip.
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
        id,
        organization_id,
        is_active,
        organizations (
          id,
          paynl_service_id,
          paynl_merchant_id,
          donations_active
        )
      `,
    )
    .eq('id', campaignId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Supabase may return `organizations` as an object or an array depending on the
  // relationship cardinality it infers. Normalize.
  const org = Array.isArray((data as { organizations?: unknown }).organizations)
    ? ((data as unknown as { organizations: Array<Record<string, unknown>> }).organizations[0] ??
      null)
    : ((data as unknown as { organizations: Record<string, unknown> | null }).organizations ??
      null);

  const organizationId =
    (org?.id as string | undefined) || (data as { organization_id: string }).organization_id;
  if (!organizationId) return null;

  // Phase 2 path: organization has its own service id AND donations are active.
  const donationsActive = org?.donations_active === true;
  const orgServiceId = (org?.paynl_service_id as string | null) || null;
  const merchantId = (org?.paynl_merchant_id as string | null) || null;

  if (donationsActive && orgServiceId) {
    return {
      serviceId: orgServiceId,
      organizationId,
      merchantId,
      usedFallback: false,
    };
  }

  // Phase 1 fallback: use the platform-wide env var only when explicitly safe.
  if (!shouldAllowPlatformPayNLFallback()) return null;
  const fallback = process.env.PAYNL_SERVICE_ID;
  if (!fallback) return null;

  return {
    serviceId: fallback,
    organizationId,
    merchantId: null,
    usedFallback: true,
  };
}

/**
 * Same logic as resolveOrganizationServiceIdForCampaign, but keyed by an
 * organization id directly. Used by membership mandates (no campaign).
 */
export async function resolveOrganizationServiceIdForOrganization(
  supabase: AdminClient,
  organizationId: string,
): Promise<ResolvedOrganizationServiceId | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, paynl_service_id, paynl_merchant_id, donations_active')
    .eq('id', organizationId)
    .single();

  if (error || !data) return null;

  const donationsActive = data.donations_active === true;
  const orgServiceId = (data.paynl_service_id as string | null) || null;
  const merchantId = (data.paynl_merchant_id as string | null) || null;

  if (donationsActive && orgServiceId) {
    return {
      serviceId: orgServiceId,
      organizationId: data.id,
      merchantId,
      usedFallback: false,
    };
  }

  if (!shouldAllowPlatformPayNLFallback()) return null;

  const fallback = process.env.PAYNL_SERVICE_ID;
  if (!fallback) return null;

  return {
    serviceId: fallback,
    organizationId: data.id,
    merchantId: null,
    usedFallback: true,
  };
}
