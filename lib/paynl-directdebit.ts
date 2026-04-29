/**
 * SEPA direct-debit enablement orchestration.
 *
 * Pay.nl Alliance issues a sales-location service (SL-XXXX-XXXX) per merchant,
 * but SEPA direct-debit (the "Incasso" payment option) is OFF by default. New
 * mandates against a service without it enabled fail with PAY-3000 (
 * "service does not have directdebit enabled"). This module is the single
 * place we toggle that on, deriving inputs from the org row and persisting
 * the lifecycle on `organizations.paynl_directdebit_status`.
 *
 * Triggered from:
 *   - merchant/onboard route, right after a successful createMerchant
 *   - merchant/status route, on every admin status sync (self-heals existing orgs)
 */
import {
  enableServicePaymentOption,
  SEPA_DIRECT_DEBIT_PAYMENT_METHOD_ID,
} from './paynl-alliance';
import type { createAdminClient } from './supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface DirectDebitOrgFields {
  id: string;
  paynl_service_id: string | null;
  paynl_directdebit_status: string | null;
  website_url?: string | null;
  name?: string | null;
}

/**
 * Build the `description` field shown on donor bank statements (max 30
 * chars per Pay.nl). Prefer the org's display name; fall back to a
 * sensible literal so we never send an empty string.
 */
function deriveBankDescription(org: DirectDebitOrgFields): string {
  const raw = (org.name || 'SEPA Incasso').trim();
  return raw.slice(0, 30) || 'SEPA Incasso';
}

/**
 * Pay.nl requires a public T&C / contact URL during the SEPA mandate
 * flow. We use the org's website_url. If that's missing we can't proceed
 * — return null and let the caller persist a 'failed:missing_website' state.
 */
function deriveWebUrl(org: DirectDebitOrgFields): string | null {
  const url = (org.website_url || '').trim();
  return url.length > 0 ? url : null;
}

export interface MaybeEnableResult {
  /** Whether we attempted a Pay.nl call this invocation. */
  attempted: boolean;
  /** Final status written to organizations.paynl_directdebit_status (if changed). */
  status: string | null;
}

/**
 * Idempotent: only triggers when status is NULL (never tried) and the org
 * has a Pay.nl service id. Pre-existing 'enabled' or 'failed:*' rows are
 * left alone — admins must explicitly retry from the UI to re-attempt.
 *
 * Errors here never throw — we persist a 'failed:<reason>' state and let
 * the caller surface it. This keeps the merchant-status endpoint reliable.
 */
export async function maybeEnableSepaDirectDebit(
  supabaseAdmin: AdminClient,
  org: DirectDebitOrgFields,
): Promise<MaybeEnableResult> {
  if (!org.paynl_service_id) {
    return { attempted: false, status: org.paynl_directdebit_status };
  }
  if (org.paynl_directdebit_status !== null) {
    return { attempted: false, status: org.paynl_directdebit_status };
  }

  const webURL = deriveWebUrl(org);
  if (!webURL) {
    const status = 'failed:missing_website_url';
    await supabaseAdmin
      .from('organizations')
      .update({ paynl_directdebit_status: status })
      .eq('id', org.id);
    return { attempted: true, status };
  }

  let nextStatus: string;
  try {
    const result = await enableServicePaymentOption({
      serviceCode: org.paynl_service_id,
      paymentMethodId: SEPA_DIRECT_DEBIT_PAYMENT_METHOD_ID,
      description: deriveBankDescription(org),
      webURL,
    });
    if (result.ok) {
      nextStatus = 'enabled';
    } else {
      const reason =
        result.errorMessage || result.errorId || 'unknown_paynl_error';
      nextStatus = `failed:${reason}`.slice(0, 200);
      console.error('[Alliance] enablePaymentOption rejected by Pay.nl', {
        organizationId: org.id,
        serviceCode: org.paynl_service_id,
        errorId: result.errorId,
        errorMessage: result.errorMessage,
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown_error';
    nextStatus = `failed:${reason}`.slice(0, 200);
    console.error('[Alliance] enablePaymentOption threw', {
      organizationId: org.id,
      serviceCode: org.paynl_service_id,
      error: reason,
    });
  }

  await supabaseAdmin
    .from('organizations')
    .update({ paynl_directdebit_status: nextStatus })
    .eq('id', org.id);

  return { attempted: true, status: nextStatus };
}
