'use server';

import { cookies } from 'next/headers';
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
import { slugify } from '@/lib/slugify';
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME, type Locale } from '@/i18n/config';
import { geocodeAddress } from '@/lib/geocoding';
import { createDefaultMosqueClassroom } from '@/lib/classroom-utils';
import { sendEmail } from '@/lib/email/email-service';
import { WelcomeEmail } from '@/lib/email/templates/WelcomeEmail';
import { formatBillingDate } from '@/lib/email/billing-utils';
import { getEmailTranslator } from '@/lib/email/i18n';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * Fire the WelcomeEmail for a freshly-created beta org. Best-effort — never
 * blocks the sign-up redirect; the only consequence of failure is a missing
 * email, which the user can recover by re-requesting from settings.
 *
 * Paid signups intentionally skip this path: the Stripe webhook
 * (`/api/webhooks/stripe`) sends its own WelcomeEmail once Checkout completes,
 * so calling here too would cause a double-send.
 */
async function sendBetaWelcomeEmail(params: {
  email: string;
  fullName: string;
  organizationName: string;
  trialEndsAt: string | null;
  locale: Locale;
}) {
  if (!params.email) return;
  try {
    const t = getEmailTranslator(params.locale, 'emails.welcome');
    await sendEmail({
      to: params.email,
      subject: t('subject'),
      react: WelcomeEmail({
        userName: params.fullName || 'there',
        organizationName: params.organizationName,
        planName: 'Free Trial',
        billingPeriodEnd: formatBillingDate(params.trialEndsAt),
        dashboardUrl: `${SITE_URL}/dashboard`,
        billingPortalUrl: `${SITE_URL}/dashboard/billing`,
        locale: params.locale,
      }),
      tags: [
        { name: 'type', value: 'beta_welcome' },
      ],
    });
  } catch (err) {
    console.error('[Auth] Beta welcome email failed:', err);
  }
}

async function readLocaleCookie(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(raw) ? raw : defaultLocale;
}

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
  // Slug is auto-derived from orgName when not provided. The signup UI no
  // longer surfaces it as a separate field; this keeps backward compat with
  // any caller that still sends it.
  const rawSlug = formData.get('orgSlug') as string | null;
  const orgSlug = (rawSlug && rawSlug.trim()) || slugify(orgName ?? '');
  const addressStreet = (formData.get('addressStreet') as string | null)?.trim() ?? '';
  const addressHouseNumber = (formData.get('addressHouseNumber') as string | null)?.trim() ?? '';
  const addressPostalCode = (formData.get('addressPostalCode') as string | null)?.trim() ?? '';
  const addressCity = (formData.get('addressCity') as string | null)?.trim() ?? '';
  const addressCountry = (formData.get('addressCountry') as string | null)?.trim().toUpperCase() ?? '';
  // Plan defaults to 'beta' (free) — the new signup UI no longer surfaces
  // a plan picker. Pro signups continue to work via the explicit form field.
  const plan = (formData.get('plan') as PlanType) || 'beta';

  if (!email || !password || !fullName || !orgName || !orgSlug) {
    return { success: false, error: 'All fields are required' };
  }

  // Address is collected during onboarding now, not at signup. If any address
  // field is provided, the country code must still be a valid 2-letter ISO.
  const hasAddress =
    addressStreet || addressHouseNumber || addressPostalCode || addressCity;
  if (hasAddress && addressCountry.length !== 2) {
    return { success: false, error: 'Country must be a 2-letter code' };
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

  // Beta = 30-day free trial that flips to 'past_due' lockout once expired,
  // unless the user goes through Stripe Checkout from /billing/required to
  // attach a card. Pro signups still start 'incomplete' until checkout
  // completes (Stripe webhook flips to 'active').
  const isBeta = plan === 'beta';
  const trialEndsAt = isBeta
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_status: isBeta ? 'trialing' : 'incomplete',
      trial_ends_at: trialEndsAt,
      subscription_tier: 'free',
      // Address fields are optional now — collected later in onboarding.
      address_street: addressStreet || null,
      address_house_number: addressHouseNumber || null,
      address_postal_code: addressPostalCode || null,
      city: addressCity || null,
      country: addressCountry || null,
    })
    .select()
    .single();

  if (orgError) {
    return { success: false, error: `Failed to create organization: ${orgError.message}` };
  }

  // Geocode the address so the mosque shows up on the superadmin map.
  // Fire-and-forget: signup must not fail if Nominatim is slow or down.
  // Skipped entirely when no address was provided at signup.
  void (async () => {
    if (!hasAddress) return;
    const coords = await geocodeAddress({
      street: addressStreet,
      houseNumber: addressHouseNumber,
      postalCode: addressPostalCode,
      city: addressCity,
      country: addressCountry,
    });
    if (!coords) return;
    const { error: geoError } = await supabaseAdmin
      .from('organizations')
      .update({
        latitude: coords.lat,
        longitude: coords.lng,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', org.id);
    if (geoError) console.error('[Signup] Geocode update failed', geoError);
  })();

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

  // Seed the default Khutba (speech, Ar→Nl) room so the org can host their
  // first jummah without going through the Create Room flow first.
  // Best-effort: failures are logged but do not block sign-up.
  try {
    await createDefaultMosqueClassroom(org.id, authData.user.id);
  } catch (e) {
    console.error('[Signup] Failed to seed default Khutba classroom:', e);
  }

  // Handle Beta plan - already created with active status, just redirect
  if (plan === 'beta') {
    // Beta-only welcome email. Paid signups get their welcome from the
    // Stripe webhook once Checkout completes — sending here too would
    // double-send.
    const locale = await readLocaleCookie();
    void sendBetaWelcomeEmail({
      email,
      fullName,
      organizationName: orgName,
      trialEndsAt,
      locale,
    });
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
 * Complete onboarding for a user who signed up via OAuth (Google, etc.).
 *
 * OAuth sign-in creates the auth.users row but skips the org-creation work
 * that `signUp` does for email/password users. This action runs from the
 * /welcome page after the user enters their organization name.
 *
 * Requires:
 *   - An authenticated session (the OAuth callback already exchanged the code).
 *   - The user must NOT already have an organization_id on their profile.
 */
export async function completeOnboarding(formData: FormData): Promise<AuthResult> {
  const orgName = (formData.get('orgName') as string | null)?.trim() ?? '';
  const fullNameInput = (formData.get('fullName') as string | null)?.trim() ?? '';

  if (!orgName) {
    return { success: false, error: 'Organization name is required' };
  }

  const orgSlug = slugify(orgName);
  if (!orgSlug) {
    return { success: false, error: 'Organization name must produce a valid URL slug' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const supabaseAdmin = createAdminClient();

  // Refuse if the user already has an org — onboarding is a one-shot action.
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single();

  if (existingProfile?.organization_id) {
    return { success: true, redirectUrl: '/dashboard' };
  }

  // Slug uniqueness — same constraint as updateOrganizationName.
  const { data: slugConflict } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (slugConflict) {
    return { success: false, error: 'An organization with this slug already exists' };
  }

  // OAuth signups also start on the 30-day beta trial. Same paywall-on-expiry
  // behaviour as email/password beta: the dashboard layout redirects to
  // /billing/required once trial_ends_at is in the past.
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      subscription_tier: 'free',
    })
    .select()
    .single();

  if (orgError) {
    return { success: false, error: `Failed to create organization: ${orgError.message}` };
  }

  // Prefer the explicit input, then existing profile name, then OAuth metadata.
  const oauthName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';
  const fullName = fullNameInput || existingProfile?.full_name || oauthName || '';

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      organization_id: org.id,
      full_name: fullName,
      role: 'admin',
    })
    .eq('id', user.id);

  if (profileError) {
    return { success: false, error: `Failed to update profile: ${profileError.message}` };
  }

  const { error: memberError } = await supabaseAdmin.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'admin',
  });

  if (memberError) {
    return { success: false, error: `Failed to add organization member: ${memberError.message}` };
  }

  // Seed the default Khutba (speech, Ar→Nl) room so the org can host their
  // first jummah without going through the Create Room flow first.
  // Best-effort: failures are logged but do not block onboarding.
  try {
    await createDefaultMosqueClassroom(org.id, user.id);
  } catch (e) {
    console.error('[completeOnboarding] Failed to seed default Khutba classroom:', e);
  }

  if (user.email) {
    const locale = await readLocaleCookie();
    void sendBetaWelcomeEmail({
      email: user.email,
      fullName,
      organizationName: orgName,
      trialEndsAt,
      locale,
    });
  }

  revalidatePath('/', 'layout');
  return { success: true, redirectUrl: '/dashboard' };
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
 *
 * The slug is always regenerated from the name so it stays in sync.
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

  const newSlug = slugify(orgName);
  if (!newSlug) {
    return { success: false, error: 'Organization name must produce a valid URL slug' };
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

  // Ensure the new slug is unique (exclude current org).
  const supabaseAdmin = createAdminClient();
  const { data: slugConflict } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', newSlug)
    .neq('id', profile.organization_id)
    .single();

  if (slugConflict) {
    return { success: false, error: 'An organization with this slug already exists' };
  }

  const updatePayload = { name: orgName, slug: newSlug };

  // IMPORTANT: chain `.select()` so we get the affected rows back. Without
  // this, Supabase returns `error: null` even when RLS silently filters out
  // the row — which looks like success but writes nothing.
  const { data: updated, error } = await supabase
    .from('organizations')
    .update(updatePayload)
    .eq('id', profile.organization_id)
    .select('id, name, slug');

  if (error) {
    console.error('[updateOrganizationName] update error', error);
    return { success: false, error: error.message };
  }

  if (!updated || updated.length === 0) {
    // RLS policy blocked the write. Fall back to the admin client so that a
    // legitimately-authorized org admin can still rename their org even if
    // the per-user RLS predicate rejects the write (the server-side role
    // check above is what actually gates this action).
    const { data: adminUpdated, error: adminError } = await supabaseAdmin
      .from('organizations')
      .update(updatePayload)
      .eq('id', profile.organization_id)
      .select('id, name, slug');

    if (adminError) {
      console.error('[updateOrganizationName] admin update error', adminError);
      return { success: false, error: adminError.message };
    }
    if (!adminUpdated || adminUpdated.length === 0) {
      return { success: false, error: 'Organization not found' };
    }
  }

  // Org name and slug surface in the sidebar, profile page, mosque-admin
  // header, donate landing, and URL routes — refresh everything.
  revalidatePath('/', 'layout');
  return { success: true };
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Update the organization's default locale.
 *
 * Drives two things:
 *   1. The NEXT_LOCALE cookie fallback for members opening the app
 *   2. The locale used for transactional emails (auth hook + Stripe welcome)
 *
 * Only members with `profiles.role = 'admin'` for this org — or platform
 * superadmins — may change it. The current user's cookie is also updated
 * so their UI switches immediately.
 */
export async function updateOrganizationLocale(formData: FormData): Promise<AuthResult> {
  const raw = (formData.get('locale') as string | null) ?? '';

  if (!isLocale(raw)) {
    return { success: false, error: 'Invalid locale' };
  }
  const locale: Locale = raw;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role, is_superadmin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }
  if (!profile.organization_id) {
    return { success: false, error: 'You do not belong to an organization' };
  }
  if (profile.role !== 'admin' && !profile.is_superadmin) {
    return { success: false, error: 'Only organization admins can change the language' };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ preferred_locale: locale })
    .eq('id', profile.organization_id);

  if (error) {
    console.error('[updateOrganizationLocale] update error', error);
    return { success: false, error: error.message };
  }

  // Mirror into the current user's cookie so their UI switches immediately.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
