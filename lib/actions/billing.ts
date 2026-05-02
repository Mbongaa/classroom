'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createStripeCustomer,
  createCheckoutSession,
  getStripePrices,
} from '@/lib/stripe';

/**
 * Convert an expired-trial beta org into a paid Pro subscription.
 *
 * Flow: ensure the org has a Stripe customer (create one on demand if the
 * beta path skipped it), open a Checkout session for the Pro price, return
 * the URL so the client can redirect.
 *
 * The success path comes back to /dashboard — the existing Stripe webhook
 * (`/api/webhooks/stripe`) flips `subscription_status` to `active` and
 * sends the WelcomeEmail, so by the time the user lands the dashboard
 * guard lets them through.
 */
export async function startTrialUpgradeCheckout(): Promise<{
  success: boolean;
  error?: string;
  checkoutUrl?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabaseAdmin = createAdminClient();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return { success: false, error: 'No organization found' };
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, stripe_customer_id, stripe_subscription_id')
    .eq('id', profile.organization_id)
    .single();

  if (orgError || !org) {
    return { success: false, error: 'Failed to load organization' };
  }

  if (org.stripe_subscription_id) {
    // Already has an active subscription — no need to checkout again.
    return { success: true, checkoutUrl: '/dashboard' };
  }

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    try {
      const customer = await createStripeCustomer(user.email, org.id, org.name);
      customerId = customer.id;
      const { error: updateErr } = await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id);
      if (updateErr) {
        // Non-fatal: the webhook reconciles via metadata.organization_id even
        // if the customer-id write loses, but log so we notice repeated misses.
        console.error('[Billing] Failed to persist stripe_customer_id:', updateErr);
      }
    } catch (e) {
      console.error('[Billing] createStripeCustomer failed:', e);
      return { success: false, error: 'Failed to set up billing. Please try again.' };
    }
  }

  const priceId = getStripePrices().pro;
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000';
  try {
    const session = await createCheckoutSession(
      customerId,
      priceId,
      org.id,
      `${baseUrl}/dashboard?welcome=1`,
      `${baseUrl}/billing/required`,
    );
    return { success: true, checkoutUrl: session.url ?? undefined };
  } catch (e) {
    console.error('[Billing] createCheckoutSession failed:', e);
    return { success: false, error: 'Failed to create checkout session.' };
  }
}
