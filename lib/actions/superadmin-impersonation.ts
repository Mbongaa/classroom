'use server';

/**
 * Server actions for superadmin "Act as Organization" impersonation.
 *
 * Both actions are gated by a fresh superadmin check (no trust in stale
 * sessions or cookies), write to the superadmin_audit_log table, and then
 * manage the acting-as cookie before redirecting.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  setActingAsCookie,
  clearActingAsCookie,
  logSuperadminAction,
} from '@/lib/superadmin/acting-as';

export type ImpersonationResult = {
  success: boolean;
  error?: string;
};

/**
 * Start impersonating an organization. Only callable by superadmins.
 *
 * Flow:
 *   1. Verify caller is authenticated.
 *   2. Verify caller is currently is_superadmin (re-checked from DB, not cached).
 *   3. Verify the target organization exists.
 *   4. Write 'enter' (or 'denied') to the audit log.
 *   5. Set the cookie and redirect to the dashboard.
 */
export async function enterOrganization(organizationId: string): Promise<ImpersonationResult> {
  if (!organizationId || typeof organizationId !== 'string') {
    return { success: false, error: 'Missing organization id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const admin = createAdminClient();

  // Re-verify superadmin status from the database (never trust session/cache).
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.is_superadmin) {
    await logSuperadminAction({
      superadminId: user.id,
      action: 'denied',
      targetOrganizationId: organizationId,
      metadata: { reason: 'not_superadmin' },
    });
    return { success: false, error: 'Forbidden' };
  }

  // Verify the target organization exists.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('id', organizationId)
    .maybeSingle();

  if (orgError || !org) {
    await logSuperadminAction({
      superadminId: user.id,
      action: 'denied',
      targetOrganizationId: organizationId,
      metadata: { reason: 'org_not_found' },
    });
    return { success: false, error: 'Organization not found' };
  }

  // Audit + set cookie.
  await logSuperadminAction({
    superadminId: user.id,
    action: 'enter',
    targetOrganizationId: org.id,
    metadata: { organization_name: org.name, organization_slug: org.slug },
  });

  await setActingAsCookie(org.id);

  // Force the dashboard tree to re-render with the impersonated org context.
  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard');
}

/**
 * Form-action wrapper around `exitOrganization` for use with `<form action={}>`,
 * which requires a `Promise<void>` signature. The underlying action redirects
 * on success, so any return value is unobserved anyway.
 */
export async function exitOrganizationFormAction(): Promise<void> {
  await exitOrganization();
}

/**
 * Stop impersonating. Clears the cookie, writes an 'exit' audit row, and
 * sends the superadmin back to /superadmin/organizations.
 *
 * Note: this action is safe to call even if no impersonation is active —
 * it will just clear nothing and redirect.
 */
export async function exitOrganization(): Promise<ImpersonationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // We don't bail out on missing user — we still want to clear the cookie
  // defensively if anyone hits this endpoint.
  if (user) {
    await logSuperadminAction({
      superadminId: user.id,
      action: 'exit',
      targetOrganizationId: null,
    });
  }

  await clearActingAsCookie();
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/superadmin', 'layout');
  redirect('/superadmin/organizations');
}
