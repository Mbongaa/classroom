/**
 * Per-mosque Pay.nl sales location resolver.
 *
 * Phase 1 used a single `PAYNL_SERVICE_ID` env var for every donation.
 * Phase 2 introduces per-mosque `SL-XXXX-XXXX` values stored on the
 * mosques table (populated by Alliance `createMerchant` calls).
 *
 * This helper resolves the right identifier to use for a given campaign:
 *
 *   1. If the campaign's mosque has `paynl_service_id` set → use it
 *      (Phase 2 multi-tenant routing)
 *   2. Otherwise fall back to `PAYNL_SERVICE_ID` env var
 *      (Phase 1 single-location behaviour)
 *
 * When Alliance is fully rolled out to every mosque, the fallback can be
 * removed and the env var retired.
 */

import type { createAdminClient } from './supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ResolvedMosqueServiceId {
  /** The SL-XXXX-XXXX to pass to Pay.nl order/mandate create calls. */
  serviceId: string;
  /** The mosque row id the campaign belongs to (for stats/logging). */
  mosqueId: string;
  /** The Pay.nl Alliance merchant id if the mosque has been onboarded. */
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
 *   - the campaign's mosque exists but has no service id AND no env fallback.
 */
export async function resolveMosqueServiceIdForCampaign(
  supabase: AdminClient,
  campaignId: string,
): Promise<ResolvedMosqueServiceId | null> {
  // Load the campaign + its mosque in a single round trip.
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
        id,
        mosque_id,
        is_active,
        mosques (
          id,
          paynl_service_id,
          paynl_merchant_id,
          is_active
        )
      `,
    )
    .eq('id', campaignId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Supabase may return `mosques` as an object or an array depending on the
  // relationship cardinality it infers. Normalize.
  const mosque = Array.isArray((data as { mosques?: unknown }).mosques)
    ? ((data as unknown as { mosques: Array<Record<string, unknown>> }).mosques[0] ?? null)
    : ((data as unknown as { mosques: Record<string, unknown> | null }).mosques ?? null);

  const mosqueId = (mosque?.id as string | undefined) || (data as { mosque_id: string }).mosque_id;
  if (!mosqueId) return null;

  // Phase 2 path: mosque has its own service id AND is active.
  const mosqueActive = mosque?.is_active === true;
  const mosqueServiceId = (mosque?.paynl_service_id as string | null) || null;
  const merchantId = (mosque?.paynl_merchant_id as string | null) || null;

  if (mosqueActive && mosqueServiceId) {
    return {
      serviceId: mosqueServiceId,
      mosqueId,
      merchantId,
      usedFallback: false,
    };
  }

  // Phase 1 fallback: use the platform-wide env var.
  const fallback = process.env.PAYNL_SERVICE_ID;
  if (!fallback) return null;

  return {
    serviceId: fallback,
    mosqueId,
    merchantId: null,
    usedFallback: true,
  };
}
