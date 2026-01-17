import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent, mapStripeStatus, getPlanFromPriceId, getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe:
 * - checkout.session.completed: Initial subscription created
 * - customer.subscription.updated: Plan changes, renewals
 * - customer.subscription.deleted: Cancellation
 * - invoice.payment_failed: Payment issues
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  const supabaseAdmin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabaseAdmin, session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabaseAdmin, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabaseAdmin, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabaseAdmin, invoice);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabaseAdmin, invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Called when a customer completes Stripe Checkout
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const organizationId = session.metadata?.organization_id;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!organizationId) {
    console.error('[Stripe Webhook] No organization_id in session metadata');
    return;
  }

  console.log(`[Stripe Webhook] Checkout completed for org: ${organizationId}`);

  // Get subscription details to determine the tier
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPlanFromPriceId(priceId);

  // Get current period end - it's a Unix timestamp
  const currentPeriodEnd = 'current_period_end' in subscription
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;

  // Update organization with Stripe IDs and activate subscription
  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: mapStripeStatus(subscription.status),
      subscription_tier: tier,
      current_period_end: currentPeriodEnd,
    })
    .eq('id', organizationId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update organization:', error);
    throw error;
  }

  console.log(`[Stripe Webhook] Organization ${organizationId} activated with ${tier} plan`);
}

/**
 * Handle customer.subscription.updated
 * Called when subscription status changes (renewal, plan change, etc.)
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const organizationId = subscription.metadata?.organization_id;

  if (!organizationId) {
    // Try to find by subscription ID
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (!org) {
      console.error('[Stripe Webhook] No organization found for subscription:', subscription.id);
      return;
    }

    await updateOrganizationSubscription(supabase, org.id, subscription);
  } else {
    await updateOrganizationSubscription(supabase, organizationId, subscription);
  }
}

/**
 * Handle customer.subscription.deleted
 * Called when subscription is canceled
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  // Find organization by subscription ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for canceled subscription:', subscription.id);
    return;
  }

  console.log(`[Stripe Webhook] Subscription canceled for org: ${org.id}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
    })
    .eq('id', org.id);

  if (error) {
    console.error('[Stripe Webhook] Failed to cancel subscription:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed
 * Called when a payment attempt fails
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  // Find organization by customer ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for customer:', customerId);
    return;
  }

  console.log(`[Stripe Webhook] Payment failed for org: ${org.id}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', org.id);

  if (error) {
    console.error('[Stripe Webhook] Failed to update payment status:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded
 * Called when a payment succeeds (renewal or retry)
 */
async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  // Get subscription ID from parent (invoice lines) or subscription_details
  // The subscription field might be in different places depending on the invoice type
  // Cast through unknown to safely access subscription property that exists at runtime
  const invoiceAny = invoice as unknown as Record<string, unknown>;
  const subscriptionId = (invoiceAny.subscription as string) ||
    (invoice.lines?.data?.[0]?.subscription as string | undefined);

  if (!subscriptionId || !customerId) {
    // Not a subscription invoice or missing customer
    return;
  }

  // Find organization by customer ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for customer:', customerId);
    return;
  }

  // Only update if was in past_due status
  if (org.subscription_status === 'past_due') {
    console.log(`[Stripe Webhook] Payment recovered for org: ${org.id}`);

    const { error } = await supabase
      .from('organizations')
      .update({
        subscription_status: 'active',
      })
      .eq('id', org.id);

    if (error) {
      console.error('[Stripe Webhook] Failed to reactivate subscription:', error);
      throw error;
    }
  }
}

/**
 * Helper to update organization subscription details
 */
async function updateOrganizationSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPlanFromPriceId(priceId);

  // Get current period end - it's a Unix timestamp
  const currentPeriodEnd = 'current_period_end' in subscription
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;

  console.log(`[Stripe Webhook] Updating subscription for org: ${organizationId}, status: ${subscription.status}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: mapStripeStatus(subscription.status),
      subscription_tier: tier,
      current_period_end: currentPeriodEnd,
    })
    .eq('id', organizationId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update subscription:', error);
    throw error;
  }
}
