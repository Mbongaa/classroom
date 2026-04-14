import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent, mapStripeStatus, getPlanFromPriceId, getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/email-service';
import {
  getOrgAdminContact,
  formatMoney,
  formatBillingDate,
  formatPlanName,
} from '@/lib/email/billing-utils';
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail';
import { PaymentReceiptEmail } from '@/lib/email/templates/PaymentReceiptEmail';
import { PaymentFailedEmail } from '@/lib/email/templates/PaymentFailedEmail';
import { SubscriptionCancelledEmail } from '@/lib/email/templates/SubscriptionCancelledEmail';
import { PlanChangedEmail } from '@/lib/email/templates/PlanChangedEmail';
import { CardExpiringEmail } from '@/lib/email/templates/CardExpiringEmail';
import { TrialEndingEmail } from '@/lib/email/templates/TrialEndingEmail';
import { UpcomingInvoiceEmail } from '@/lib/email/templates/UpcomingInvoiceEmail';

/**
 * Stripe Webhook Handler
 *
 * Subscription lifecycle + branded transactional emails. Email sends are
 * always best-effort and never block the webhook acknowledgement.
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

      case 'customer.source.expiring': {
        const source = event.data.object as Stripe.Card | Stripe.BankAccount;
        await handleCardExpiring(supabaseAdmin, source);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe fires this ~3 days before trial_end. Once per trial.
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialWillEnd(supabaseAdmin, subscription);
        break;
      }

      case 'invoice.upcoming': {
        // Stripe fires this ~7 days before the invoice finalises (configurable
        // in Dashboard → Billing → Subscriptions). Once per upcoming invoice.
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceUpcoming(supabaseAdmin, invoice);
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

// --- URL helpers ----------------------------------------------------------

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const dashboardUrl = () => `${siteUrl()}/dashboard`;
const billingPortalUrl = () => `${siteUrl()}/dashboard/billing`;

// --- Safe email wrapper ---------------------------------------------------

/**
 * Wraps a send so an email failure never bubbles up into the webhook handler.
 * Stripe will retry the webhook on non-2xx, and we don't want a flaky email
 * provider causing duplicate DB writes.
 */
async function safeSend(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`[Stripe Webhook] Email sent: ${label}`);
  } catch (err) {
    console.error(`[Stripe Webhook] Email failed (${label}):`, err);
  }
}

// --- checkout.session.completed -------------------------------------------

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

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPlanFromPriceId(priceId);

  const currentPeriodEnd = 'current_period_end' in subscription
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;

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

  const contact = await getOrgAdminContact(supabase, { organizationId });
  if (!contact) return;

  await safeSend('welcome', () =>
    sendEmail({
      to: contact.email,
      subject: 'Welcome to Bayaan — your subscription is active',
      react: WelcomeEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(tier),
        billingPeriodEnd: formatBillingDate(currentPeriodEnd),
        dashboardUrl: dashboardUrl(),
        billingPortalUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'subscription_confirmation' },
        { name: 'organization_id', value: organizationId },
      ],
    }),
  );
}

// --- customer.subscription.updated ----------------------------------------

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  // Resolve organization first — either via metadata or by subscription ID.
  let organizationId = subscription.metadata?.organization_id;
  let oldTier: string | null = null;

  if (!organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, subscription_tier')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (!org) {
      console.error('[Stripe Webhook] No organization found for subscription:', subscription.id);
      return;
    }
    organizationId = org.id;
    oldTier = org.subscription_tier ?? null;
  } else {
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_tier')
      .eq('id', organizationId)
      .maybeSingle();
    oldTier = org?.subscription_tier ?? null;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const newTier = getPlanFromPriceId(priceId);

  const currentPeriodEnd = 'current_period_end' in subscription
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;

  console.log(`[Stripe Webhook] Updating subscription for org: ${organizationId}, status: ${subscription.status}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: mapStripeStatus(subscription.status),
      subscription_tier: newTier,
      current_period_end: currentPeriodEnd,
    })
    .eq('id', organizationId);

  if (error) {
    console.error('[Stripe Webhook] Failed to update subscription:', error);
    throw error;
  }

  // Only email if the tier actually changed (skip pure renewal touches).
  if (oldTier && oldTier !== newTier) {
    const contact = await getOrgAdminContact(supabase, { organizationId });
    if (!contact) return;

    await safeSend('plan_changed', () =>
      sendEmail({
        to: contact.email,
        subject: `Your plan changed to ${formatPlanName(newTier)}`,
        react: PlanChangedEmail({
          userName: contact.fullName,
          organizationName: contact.organizationName,
          oldPlanName: formatPlanName(oldTier),
          newPlanName: formatPlanName(newTier),
          effectiveDate: formatBillingDate(Math.floor(Date.now() / 1000)),
          nextBillingDate: formatBillingDate(currentPeriodEnd),
          billingPortalUrl: billingPortalUrl(),
        }),
        tags: [
          { name: 'type', value: 'plan_changed' },
          { name: 'organization_id', value: organizationId },
        ],
      }),
    );
  }
}

// --- customer.subscription.deleted ----------------------------------------

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  // Capture the tier BEFORE we downgrade to free, so the email reflects
  // the plan the user was actually on.
  const { data: org } = await supabase
    .from('organizations')
    .select('id, subscription_tier')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for canceled subscription:', subscription.id);
    return;
  }

  const cancelledTier = org.subscription_tier ?? 'free';

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

  const contact = await getOrgAdminContact(supabase, { organizationId: org.id });
  if (!contact) return;

  // If Stripe cancelled at period end, surface that date; otherwise it's immediate.
  const accessUntil =
    'cancel_at_period_end' in subscription && (subscription as { cancel_at_period_end?: boolean }).cancel_at_period_end
      ? formatBillingDate((subscription as { current_period_end?: number }).current_period_end ?? null)
      : undefined;

  await safeSend('subscription_cancelled', () =>
    sendEmail({
      to: contact.email,
      subject: 'Your Bayaan subscription has been cancelled',
      react: SubscriptionCancelledEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(cancelledTier),
        accessUntilDate: accessUntil,
        reactivateUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'subscription_cancelled' },
        { name: 'organization_id', value: org.id },
      ],
    }),
  );
}

// --- invoice.payment_failed -----------------------------------------------

async function handlePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for customer:', customerId);
    return;
  }

  console.log(`[Stripe Webhook] Payment failed for org: ${org.id}`);

  const { error } = await supabase
    .from('organizations')
    .update({ subscription_status: 'past_due' })
    .eq('id', org.id);

  if (error) {
    console.error('[Stripe Webhook] Failed to update payment status:', error);
    throw error;
  }

  const contact = await getOrgAdminContact(supabase, { organizationId: org.id });
  if (!contact) return;

  // last_finalization_error is the closest standard field for a human reason.
  const failureReason =
    (invoice as unknown as { last_finalization_error?: { message?: string } }).last_finalization_error?.message ??
    undefined;

  await safeSend('payment_failed', () =>
    sendEmail({
      to: contact.email,
      subject: `Payment failed for ${contact.organizationName} — please update your card`,
      react: PaymentFailedEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(contact.subscriptionTier),
        amount: formatMoney(invoice.amount_due, invoice.currency),
        failureReason,
        nextRetryDate: invoice.next_payment_attempt
          ? formatBillingDate(invoice.next_payment_attempt)
          : undefined,
        updatePaymentUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'payment_failed' },
        { name: 'organization_id', value: org.id },
      ],
    }),
  );
}

// --- invoice.payment_succeeded --------------------------------------------

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  const invoiceAny = invoice as unknown as Record<string, unknown>;
  const subscriptionId = (invoiceAny.subscription as string) ||
    (invoice.lines?.data?.[0]?.subscription as string | undefined);

  if (!subscriptionId || !customerId) return;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!org) {
    console.error('[Stripe Webhook] No organization found for customer:', customerId);
    return;
  }

  // Auto-recover from past_due if the retry succeeded.
  if (org.subscription_status === 'past_due') {
    console.log(`[Stripe Webhook] Payment recovered for org: ${org.id}`);
    const { error } = await supabase
      .from('organizations')
      .update({ subscription_status: 'active' })
      .eq('id', org.id);

    if (error) {
      console.error('[Stripe Webhook] Failed to reactivate subscription:', error);
      throw error;
    }
  }

  // Skip the first invoice — checkout.session.completed already sent the welcome email.
  if (invoice.billing_reason === 'subscription_create') return;

  const contact = await getOrgAdminContact(supabase, { organizationId: org.id });
  if (!contact) return;

  const linePeriodEnd = invoice.lines?.data?.[0]?.period?.end ?? null;

  await safeSend('payment_receipt', () =>
    sendEmail({
      to: contact.email,
      subject: `Payment received — ${formatMoney(invoice.amount_paid, invoice.currency)}`,
      react: PaymentReceiptEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(contact.subscriptionTier),
        amount: formatMoney(invoice.amount_paid, invoice.currency),
        invoiceNumber: invoice.number ?? invoice.id ?? '—',
        invoiceDate: formatBillingDate(invoice.created),
        nextBillingDate: formatBillingDate(linePeriodEnd),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
        billingPortalUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'payment_receipt' },
        { name: 'organization_id', value: org.id },
      ],
    }),
  );
}

// --- customer.source.expiring ---------------------------------------------

async function handleCardExpiring(
  supabase: ReturnType<typeof createAdminClient>,
  source: Stripe.Card | Stripe.BankAccount,
) {
  // Only cards have an expiry date; bank accounts don't.
  if (source.object !== 'card') return;
  const card = source as Stripe.Card;

  const customerId = typeof card.customer === 'string' ? card.customer : card.customer?.id;
  if (!customerId) {
    console.error('[Stripe Webhook] card expiring event has no customer:', card.id);
    return;
  }

  const contact = await getOrgAdminContact(supabase, { customerId });
  if (!contact) return;

  await safeSend('card_expiring', () =>
    sendEmail({
      to: contact.email,
      subject: `Your ${card.brand} ending ${card.last4} expires soon`,
      react: CardExpiringEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        cardBrand: card.brand,
        last4: card.last4,
        expiryMonth: String(card.exp_month).padStart(2, '0'),
        expiryYear: String(card.exp_year),
        updatePaymentUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'card_expiring' },
        { name: 'organization_id', value: contact.organizationId },
      ],
    }),
  );
}

// --- customer.subscription.trial_will_end ---------------------------------

async function handleTrialWillEnd(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
) {
  // Resolve org via metadata first (set on checkout), fall back to subId.
  let organizationId = subscription.metadata?.organization_id;
  if (!organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (!org) {
      console.error('[Stripe Webhook] trial_will_end: org not found', subscription.id);
      return;
    }
    organizationId = org.id;
  }

  const contact = await getOrgAdminContact(supabase, { organizationId });
  if (!contact) return;

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPlanFromPriceId(priceId);
  const price = subscription.items.data[0]?.price;
  const amountMinor = price?.unit_amount ?? 0;
  const currency = price?.currency ?? 'eur';

  const trialEndUnix = subscription.trial_end;
  if (!trialEndUnix) {
    console.error('[Stripe Webhook] trial_will_end without trial_end:', subscription.id);
    return;
  }

  const hasPaymentMethod =
    Boolean(subscription.default_payment_method) ||
    Boolean(subscription.default_source);

  await safeSend('trial_ending', () =>
    sendEmail({
      to: contact.email,
      subject: `Your Bayaan trial ends ${formatBillingDate(trialEndUnix)}`,
      react: TrialEndingEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(tier),
        trialEndDate: formatBillingDate(trialEndUnix),
        amount: formatMoney(amountMinor, currency),
        hasPaymentMethod,
        billingPortalUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'trial_ending' },
        { name: 'organization_id', value: contact.organizationId },
      ],
    }),
  );
}

// --- invoice.upcoming -----------------------------------------------------

async function handleInvoiceUpcoming(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice,
) {
  // Skip the very first invoice of a subscription — that's covered by the
  // welcome email already. billing_reason tells us why Stripe is billing.
  if (invoice.billing_reason === 'subscription_create') return;

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;
  if (!customerId) {
    console.error('[Stripe Webhook] invoice.upcoming: no customer', invoice.id);
    return;
  }

  const contact = await getOrgAdminContact(supabase, { customerId });
  if (!contact) return;

  // Derive the tier from the subscription's active price. Newer Stripe API
  // versions expose the price via `pricing.price_details`, older ones via
  // a top-level `price` on the line item — handle both defensively.
  const line = invoice.lines?.data?.[0] as
    | (Stripe.InvoiceLineItem & {
        price?: { id?: string };
        pricing?: { price_details?: { price?: string } };
      })
    | undefined;
  const priceId = line?.price?.id ?? line?.pricing?.price_details?.price ?? '';
  const tier = getPlanFromPriceId(priceId);

  // Pull the card brand + last4 if a default payment method is set. Best-
  // effort: if lookup fails the template falls back to "your card on file".
  let cardBrand: string | undefined;
  let last4: string | undefined;
  const pmId =
    typeof invoice.default_payment_method === 'string'
      ? invoice.default_payment_method
      : invoice.default_payment_method?.id;

  if (pmId) {
    try {
      const pm = await getStripe().paymentMethods.retrieve(pmId);
      if (pm.card) {
        cardBrand = pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1);
        last4 = pm.card.last4;
      }
    } catch (err) {
      console.warn('[Stripe Webhook] invoice.upcoming: pm lookup failed', err);
    }
  }

  const billingDate = formatBillingDate(
    invoice.next_payment_attempt ?? invoice.period_end,
  );

  await safeSend('invoice_upcoming', () =>
    sendEmail({
      to: contact.email,
      subject: `Upcoming charge — ${formatMoney(invoice.amount_due, invoice.currency)} on ${billingDate}`,
      react: UpcomingInvoiceEmail({
        userName: contact.fullName,
        organizationName: contact.organizationName,
        planName: formatPlanName(tier),
        amount: formatMoney(invoice.amount_due, invoice.currency),
        billingDate,
        cardBrand,
        last4,
        billingPortalUrl: billingPortalUrl(),
      }),
      tags: [
        { name: 'type', value: 'invoice_upcoming' },
        { name: 'organization_id', value: contact.organizationId },
      ],
    }),
  );
}
