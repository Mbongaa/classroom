'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createStripeCustomer,
  createCheckoutSession,
  STRIPE_PRICES,
  PlanType,
} from '@/lib/stripe';

export type AuthResult = {
  success: boolean;
  error?: string;
  data?: any;
  checkoutUrl?: string;
};

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * Sign up with email, password, organization details, and plan selection
 * Creates user, organization, Stripe customer, and redirects to Stripe Checkout
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const orgName = formData.get('orgName') as string;
  const orgSlug = formData.get('orgSlug') as string;
  const plan = (formData.get('plan') as PlanType) || 'pro';

  if (!email || !password || !fullName || !orgName || !orgSlug) {
    return { success: false, error: 'All fields are required' };
  }

  // Validate plan
  if (!['pro', 'enterprise'].includes(plan)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  const supabase = await createClient();

  // Sign up the user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (signUpError) {
    return { success: false, error: signUpError.message };
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Use admin client for initial setup (bypasses RLS)
  const supabaseAdmin = createAdminClient();

  // Create organization with 'incomplete' subscription status
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_status: 'incomplete',
      subscription_tier: 'free', // Will be updated by webhook after payment
    })
    .select()
    .single();

  if (orgError) {
    return { success: false, error: `Failed to create organization: ${orgError.message}` };
  }

  // Update profile with organization using admin client
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      organization_id: org.id,
      full_name: fullName,
      role: 'admin', // First user is always admin
    })
    .eq('id', authData.user.id);

  if (profileError) {
    return { success: false, error: `Failed to update profile: ${profileError.message}` };
  }

  // Add user as organization member using admin client
  const { error: memberError } = await supabaseAdmin.from('organization_members').insert({
    organization_id: org.id,
    user_id: authData.user.id,
    role: 'admin',
  });

  if (memberError) {
    return { success: false, error: `Failed to add organization member: ${memberError.message}` };
  }

  // Create Stripe customer
  let stripeCustomer;
  try {
    stripeCustomer = await createStripeCustomer(email, org.id, orgName);
  } catch (stripeError) {
    console.error('[Signup] Stripe customer creation failed:', stripeError);
    return { success: false, error: 'Failed to set up billing. Please try again.' };
  }

  // Update organization with Stripe customer ID
  const { error: updateOrgError } = await supabaseAdmin
    .from('organizations')
    .update({
      stripe_customer_id: stripeCustomer.id,
    })
    .eq('id', org.id);

  if (updateOrgError) {
    console.error('[Signup] Failed to save Stripe customer ID:', updateOrgError);
    // Continue anyway - webhook will handle this
  }

  // Create Stripe Checkout session
  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    return { success: false, error: 'Selected plan is not available. Please contact support.' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const successUrl = `${baseUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/signup/canceled`;

  let checkoutSession;
  try {
    checkoutSession = await createCheckoutSession(
      stripeCustomer.id,
      priceId,
      org.id,
      successUrl,
      cancelUrl
    );
  } catch (checkoutError) {
    console.error('[Signup] Checkout session creation failed:', checkoutError);
    return { success: false, error: 'Failed to create checkout session. Please try again.' };
  }

  revalidatePath('/', 'layout');

  // Return checkout URL for client-side redirect
  return {
    success: true,
    checkoutUrl: checkoutSession.url!,
  };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Get the current authenticated user with profile data
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      `
      *,
      organization:organizations(*)
    `,
    )
    .eq('id', user.id)
    .single();

  return { user, profile };
}

/**
 * Update user profile
 */
export async function updateProfile(formData: FormData): Promise<AuthResult> {
  const fullName = formData.get('fullName') as string;
  const avatarUrl = formData.get('avatarUrl') as string;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/profile');
  return { success: true };
}
