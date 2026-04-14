import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgAdminContact, type OrgAdminContact } from './billing-utils';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Build the cobranded From header for donor-facing emails.
 *
 * Format: `"Al-Noor Mosque via Bayaan <donations@bayaan.ai>"`. The mosque
 * reads as the brand; `via Bayaan` preserves trust and inbox providers'
 * unaligned-sender display. Strips quotes/angle brackets from the name so a
 * malicious mosque name can't forge headers.
 */
export function buildDonorFrom(mosqueName: string): string {
  const safeName = mosqueName.replace(/["<>,]/g, '').trim().slice(0, 64);
  const address =
    process.env.EMAIL_FROM_DONATIONS ||
    process.env.EMAIL_FROM ||
    'donations@bayaan.ai';
  return `${safeName} via Bayaan <${address}>`;
}

export interface DonationContext {
  admin: OrgAdminContact;
  amountCents: number;
  currency: string;
  donorName: string | null;
  donorEmail: string | null;
  campaignTitle: string | null;
  paidAt: string | null;
  orderId: string;
}

export interface MandateContext {
  admin: OrgAdminContact;
  monthlyAmountCents: number | null;
  currency: string;
  donorName: string;
  donorEmail: string | null;
  campaignTitle: string | null;
  firstDebitDate: string | null;
  mandateCode: string;
}

export interface StornoContext {
  admin: OrgAdminContact;
  amountCents: number;
  currency: string;
  donorName: string;
  donorEmail: string | null;
  campaignTitle: string | null;
  mandateCode: string | null;
  directDebitId: string;
  processDate: string | null;
}

/**
 * Load a fully-resolved donation context by Pay.nl order id.
 *
 * Joins transactions → campaigns to get the mosque (org) id and campaign
 * title, then reuses getOrgAdminContact to fetch the admin recipient.
 * Returns null if any link is missing — callers treat email as best-effort.
 */
export async function getDonationContext(
  supabase: AdminClient,
  orderId: string,
): Promise<DonationContext | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      paynl_order_id,
      amount,
      currency,
      donor_name,
      donor_email,
      paid_at,
      stats_extra3,
      campaigns(title)
    `,
    )
    .eq('paynl_order_id', orderId)
    .maybeSingle();

  if (error || !data) {
    console.error('[donation-utils] transaction lookup failed', { orderId, error });
    return null;
  }

  const organizationId = data.stats_extra3;
  if (!organizationId) {
    console.error('[donation-utils] transaction missing mosque id', { orderId });
    return null;
  }

  const admin = await getOrgAdminContact(supabase, { organizationId });
  if (!admin) return null;

  const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;

  return {
    admin,
    amountCents: data.amount,
    currency: data.currency,
    donorName: data.donor_name,
    donorEmail: data.donor_email,
    campaignTitle: campaign?.title ?? null,
    paidAt: data.paid_at,
    orderId: data.paynl_order_id,
  };
}

/**
 * Load a mandate context by Pay.nl mandate code (IO-XXXX-XXXX-XXXX).
 *
 * Used for NewMandateCreated emails. The mandate row has donor name and
 * campaign id; we join campaigns → mosque_id to find the admin.
 */
export async function getMandateContext(
  supabase: AdminClient,
  mandateCode: string,
  opts?: { firstDebitDate?: string | null },
): Promise<MandateContext | null> {
  const { data, error } = await supabase
    .from('mandates')
    .select(
      `
      paynl_mandate_id,
      donor_name,
      donor_email,
      monthly_amount,
      campaigns(title, mosque_id)
    `,
    )
    .eq('paynl_mandate_id', mandateCode)
    .maybeSingle();

  if (error || !data) {
    console.error('[donation-utils] mandate lookup failed', { mandateCode, error });
    return null;
  }

  const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;
  const organizationId = campaign?.mosque_id;

  if (!organizationId) {
    console.error('[donation-utils] mandate missing mosque id via campaign', { mandateCode });
    return null;
  }

  const admin = await getOrgAdminContact(supabase, { organizationId });
  if (!admin) return null;

  return {
    admin,
    monthlyAmountCents: data.monthly_amount,
    currency: 'EUR',
    donorName: data.donor_name,
    donorEmail: data.donor_email,
    campaignTitle: campaign?.title ?? null,
    firstDebitDate: opts?.firstDebitDate ?? null,
    mandateCode: data.paynl_mandate_id,
  };
}

/**
 * Load a storno (reversed recurring debit) context by Pay.nl direct-debit id.
 *
 * Joins direct_debits → mandates → campaigns to reach the mosque admin.
 */
export async function getStornoContext(
  supabase: AdminClient,
  directDebitId: string,
): Promise<StornoContext | null> {
  const { data, error } = await supabase
    .from('direct_debits')
    .select(
      `
      paynl_directdebit_id,
      amount,
      currency,
      process_date,
      mandates(
        paynl_mandate_id,
        donor_name,
        donor_email,
        campaigns(title, mosque_id)
      )
    `,
    )
    .eq('paynl_directdebit_id', directDebitId)
    .maybeSingle();

  if (error || !data) {
    console.error('[donation-utils] direct_debit lookup failed', { directDebitId, error });
    return null;
  }

  const mandate = Array.isArray(data.mandates) ? data.mandates[0] : data.mandates;
  if (!mandate) {
    console.error('[donation-utils] storno missing mandate', { directDebitId });
    return null;
  }

  const campaign = Array.isArray(mandate.campaigns) ? mandate.campaigns[0] : mandate.campaigns;
  const organizationId = campaign?.mosque_id;
  if (!organizationId) {
    console.error('[donation-utils] storno missing mosque id', { directDebitId });
    return null;
  }

  const admin = await getOrgAdminContact(supabase, { organizationId });
  if (!admin) return null;

  return {
    admin,
    amountCents: data.amount,
    currency: data.currency,
    donorName: mandate.donor_name,
    donorEmail: mandate.donor_email,
    campaignTitle: campaign?.title ?? null,
    mandateCode: mandate.paynl_mandate_id ?? null,
    directDebitId: data.paynl_directdebit_id,
    processDate: data.process_date,
  };
}
