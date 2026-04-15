import { type Locale } from '@/i18n/config';
import { resolveEmailLocale } from '@/lib/email/i18n';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface OrgAdminContact {
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  subscriptionTier: string | null;
  currentPeriodEnd: string | null;
  preferredLocale: Locale;
}

/**
 * Fetch the admin email + org context for a billing event.
 *
 * Stripe events sometimes give us only `customerId`, others give us
 * `organizationId` via metadata. Pass whichever you have.
 *
 * Returns null (and logs) if no org or admin profile can be resolved —
 * callers should treat email as best-effort and never block the webhook.
 */
export async function getOrgAdminContact(
  supabase: AdminClient,
  params: { organizationId?: string; customerId?: string },
): Promise<OrgAdminContact | null> {
  const { organizationId, customerId } = params;

  if (!organizationId && !customerId) {
    console.error('[billing-utils] getOrgAdminContact called without id');
    return null;
  }

  const baseSelect = `
    id,
    name,
    subscription_tier,
    current_period_end,
    preferred_locale,
    organization_members!inner(
      role,
      profiles!inner(full_name, email)
    )
  `;

  const { data, error } = organizationId
    ? await supabase
        .from('organizations')
        .select(baseSelect)
        .eq('id', organizationId)
        .eq('organization_members.role', 'admin')
        .maybeSingle()
    : await supabase
        .from('organizations')
        .select(baseSelect)
        .eq('stripe_customer_id', customerId!)
        .eq('organization_members.role', 'admin')
        .maybeSingle();

  if (error || !data) {
    console.error('[billing-utils] Failed to fetch org admin:', { params, error });
    return null;
  }

  const orgMember = (data as { organization_members?: Array<{ profiles?: { full_name?: string; email?: string } }> })
    .organization_members?.[0];
  const profile = orgMember?.profiles;

  if (!profile?.email) {
    console.error('[billing-utils] No admin email for org:', data.id);
    return null;
  }

  return {
    organizationId: data.id,
    organizationName: data.name,
    email: profile.email,
    fullName: profile.full_name || 'there',
    subscriptionTier: data.subscription_tier ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    preferredLocale: resolveEmailLocale(
      (data as { preferred_locale?: string | null }).preferred_locale,
    ),
  };
}

/**
 * Format a Stripe amount (in the smallest currency unit, e.g. cents) into
 * a localised display string like "€29.00".
 */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);
}

/**
 * Format a Stripe Unix timestamp (seconds) or ISO string into "April 14, 2026".
 */
export function formatBillingDate(input: number | string | null | undefined): string {
  if (input == null) return '—';
  const date = typeof input === 'number' ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Pretty-print a tier slug (e.g. "pro" → "Pro", "starter" → "Starter").
 */
export function formatPlanName(tier: string | null | undefined): string {
  if (!tier) return 'Free';
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}
