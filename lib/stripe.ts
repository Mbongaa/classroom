import Stripe from 'stripe';

// Server-side Stripe client - never expose this to the client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// Price IDs for subscription plans (set in Stripe Dashboard)
export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRO_PRICE_ID!,
} as const;

export type PlanType = keyof typeof STRIPE_PRICES;

/**
 * Create a Stripe Customer for an organization
 */
export async function createStripeCustomer(
  email: string,
  organizationId: string,
  organizationName: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email,
    name: organizationName,
    metadata: {
      organization_id: organizationId,
    },
  });

  return customer;
}

/**
 * Create a Stripe Checkout Session for subscription signup
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  organizationId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        organization_id: organizationId,
      },
    },
    metadata: {
      organization_id: organizationId,
    },
    billing_address_collection: 'required',
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * Create a Stripe Customer Portal Session for self-service billing management
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Retrieve a Stripe Customer by ID
 */
export async function getStripeCustomer(
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  return stripe.customers.retrieve(customerId);
}

/**
 * Retrieve a Stripe Subscription by ID
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a Stripe Subscription
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  // Cancel at period end (more user-friendly)
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

/**
 * Map Stripe subscription status to our internal status
 */
export function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'unpaid',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete',
    trialing: 'trialing',
    paused: 'canceled',
  };

  return statusMap[stripeStatus] || 'incomplete';
}

/**
 * Map price ID to subscription tier
 */
export function getPlanFromPriceId(priceId: string): 'pro' | 'free' {
  if (priceId === STRIPE_PRICES.pro) return 'pro';
  return 'free';
}
