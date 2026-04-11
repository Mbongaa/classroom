'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createStripeCustomer,
  createCheckoutSession,
  getStripePrices,
  PlanType,
} from '@/lib/stripe';

export type AuthResult = {
  success: boolean;
  error?: string;
  data?: any;
  checkoutUrl?: string;
  redirectUrl?: string; // For non-Stripe redirects (e.g., beta plan)
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

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Check if user is superadmin to redirect accordingly
  let redirectPath = '/dashboard';
  if (authData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_superadmin')
      .eq('id', authData.user.id)
      .single();

    if (profile?.is_superadmin) {
      redirectPath = '/superadmin';
    }
  }

  revalidatePath('/', 'layout');
  redirect(redirectPath);
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
  if (!['pro', 'beta'].includes(plan)) {
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
      // Where the user lands after clicking the confirmation link in their email.
      // The actual confirmation endpoint is /api/auth/confirm (handled by the
      // Send Email Hook + verifyOtp); this is just the post-confirmation destination.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
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

  // Create organization - beta gets active status immediately, pro starts as incomplete
  const isBeta = plan === 'beta';
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_status: isBeta ? 'active' : 'incomplete',
      subscription_tier: 'free',
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

  // Handle Beta plan - already created with active status, just redirect
  if (plan === 'beta') {
    revalidatePath('/', 'layout');
    return {
      success: true,
      redirectUrl: '/dashboard',
    };
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
  const priceId = getStripePrices()[plan];
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
 * Send a password reset email.
 *
 * Triggers Supabase's `recovery` auth event, which fires the Send Email Hook
 * (`/api/auth/email-hook`) → branded `PasswordResetEmail` via Resend.
 *
 * Always returns success even if the email doesn't exist, to avoid leaking
 * which addresses are registered (account-enumeration protection).
 */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;

  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  const supabase = await createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Log internally but don't surface — protect against account enumeration.
    console.error('[requestPasswordReset]', error.message);
  }

  return { success: true };
}

/**
 * Update the current user's password.
 *
 * Called from /reset-password after the user clicks the email link.
 * The verifyOtp() in /api/auth/confirm has already created an authenticated
 * session by the time this runs, so updateUser() will work.
 */
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || !confirmPassword) {
    return { success: false, error: 'Both password fields are required' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'Your reset link has expired. Please request a new password reset.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, redirectUrl: '/dashboard' };
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

/**
 * Rename the current user's organization.
 *
 * Only members with `profiles.role = 'admin'` are allowed — enforced both
 * at the server-action layer and by the RLS policy on `organizations`.
 * Leaves slug, subscription status, and Stripe ids untouched; only the
 * display name changes.
 */
export async function updateOrganizationName(formData: FormData): Promise<AuthResult> {
  const raw = (formData.get('orgName') as string | null) ?? '';
  const orgName = raw.trim();

  if (!orgName) {
    return { success: false, error: 'Organization name is required' };
  }
  if (orgName.length > 100) {
    return { success: false, error: 'Organization name must be 100 characters or fewer' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }
  if (!profile.organization_id) {
    return { success: false, error: 'You do not belong to an organization' };
  }
  if (profile.role !== 'admin') {
    return { success: false, error: 'Only organization admins can rename the organization' };
  }

  const { error } = await supabase
    .from('organizations')
    .update({ name: orgName })
    .eq('id', profile.organization_id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Org name surfaces in the sidebar, profile page, mosque-admin header,
  // and donate landing — refresh the whole layout to pick it up.
  revalidatePath('/', 'layout');
  return { success: true };
}
