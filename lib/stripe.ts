import Stripe from 'stripe';

// Server-side Stripe client - lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return stripeInstance;
}

// Price IDs for subscription plans (set in Stripe Dashboard)
export function getStripePrices() {
  if (!process.env.STRIPE_PRO_PRICE_ID) {
    throw new Error('STRIPE_PRO_PRICE_ID is not set');
  }
  return {
    pro: process.env.STRIPE_PRO_PRICE_ID,
  } as const;
}

export type PlanType = 'pro';

/**
 * Create a Stripe Customer for an organization
 */
export async function createStripeCustomer(
  email: string,
  organizationId: string,
  organizationName: string
): Promise<Stripe.Customer> {
  const customer = await getStripe().customers.create({
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
  const session = await getStripe().checkout.sessions.create({
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
  const session = await getStripe().billingPortal.sessions.create({
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
  return getStripe().customers.retrieve(customerId);
}

/**
 * Retrieve a Stripe Subscription by ID
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a Stripe Subscription
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return getStripe().subscriptions.cancel(subscriptionId);
  }

  // Cancel at period end (more user-friendly)
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Retrieve default payment method for a Stripe Customer
 */
export async function getDefaultPaymentMethod(
  customerId: string
): Promise<Stripe.PaymentMethod | null> {
  try {
    const customer = await getStripeCustomer(customerId);

    // Check if customer was deleted or has no payment method
    if ('deleted' in customer && customer.deleted) {
      return null;
    }

    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethodId) {
      return null;
    }

    // Handle both string ID and expanded object
    const paymentMethodId =
      typeof defaultPaymentMethodId === 'string'
        ? defaultPaymentMethodId
        : defaultPaymentMethodId.id;

    return getStripe().paymentMethods.retrieve(paymentMethodId);
  } catch (error) {
    console.error('[Stripe] Failed to fetch payment method:', error);
    return null;
  }
}

/**
 * List invoices for a Stripe Customer
 */
export async function listCustomerInvoices(
  customerId: string,
  limit: number = 5
): Promise<Stripe.ApiList<Stripe.Invoice>> {
  return getStripe().invoices.list({
    customer: customerId,
    limit,
  });
}

/**
 * Get detailed subscription with price info
 */
export async function getSubscriptionDetails(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'default_payment_method'],
  });
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
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
  if (priceId === getStripePrices().pro) return 'pro';
  return 'free';
}
