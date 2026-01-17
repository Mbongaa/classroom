import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, getStripePrices, PlanType } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

/**
 * Create a Stripe Checkout Session for subscription signup
 *
 * POST /api/stripe/create-checkout-session
 * Body: { organizationId: string, plan: 'pro' | 'enterprise' }
 * Returns: { url: string } - Stripe Checkout URL
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId, plan } = body as {
      organizationId: string;
      plan: PlanType;
    };

    if (!organizationId || !plan) {
      return NextResponse.json(
        { error: 'Missing organizationId or plan' },
        { status: 400 }
      );
    }

    // Validate plan type
    if (!['pro', 'enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro" or "enterprise"' },
        { status: 400 }
      );
    }

    // Verify user belongs to this organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if already has a customer ID
    if (!organization.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Organization does not have a Stripe customer. Please complete signup.' },
        { status: 400 }
      );
    }

    // Get the price ID for the selected plan
    const priceId = getStripePrices()[plan];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured for this plan' },
        { status: 500 }
      );
    }

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/signup/canceled`;

    // Create checkout session
    const session = await createCheckoutSession(
      organization.stripe_customer_id,
      priceId,
      organizationId,
      successUrl,
      cancelUrl
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Create checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
