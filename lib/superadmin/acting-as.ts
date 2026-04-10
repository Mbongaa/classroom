/**
 * Superadmin "Act as Organization" cookie + validation helpers.
 *
 * The impersonation feature lets a superadmin enter an organization's
 * dashboard as if they were a member. The active impersonation is tracked
 * via an httpOnly cookie holding the target organization id. Every privileged
 * helper in `lib/api-auth.ts` calls these utilities to detect the cookie,
 * verify the caller is *still* a superadmin, and (if so) override the
 * profile's organization_id to the impersonated org.
 *
 * Security model:
 *   - Cookie is httpOnly + secure + sameSite=lax + 60min sliding TTL.
 *   - Validation happens on EVERY request that hits api-auth — never trust
 *     the cookie alone.
 *   - All enter/exit/denied events are written to `superadmin_audit_log`
 *     via the service_role admin client (write-only from the server).
 *   - On any validation failure we fail closed: clear the cookie and act
 *     as if no impersonation was active.
 */

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export const ACTING_AS_COOKIE = 'sa_acting_as_org';
export const ACTING_AS_TTL_SECONDS = 60 * 60; // 60 minutes (sliding)

export type ActingAsContext = {
  organizationId: string;
  organizationName: string | null;
  organizationSlug: string | null;
};

/**
 * Read the acting-as cookie. Returns the raw organization id if present, or
 * null. Does NOT validate the caller — use `resolveActingAsForUser` for that.
 */
export async function readActingAsCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ACTING_AS_COOKIE)?.value;
  if (!value) return null;
  // Basic UUID shape check — anything else is bogus and we ignore it.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return null;
  }
  return value;
}

/**
 * Set the acting-as cookie with a fresh sliding TTL. Call this on every
 * privileged request that successfully validates so the session keeps
 * extending while the superadmin is actively using the dashboard.
 *
 * Cookie writes only work in Server Actions and Route Handlers — Server
 * Components can read but not write. We swallow the "Server Component"
 * error here so callers (like the dashboard layout) can call us safely;
 * the next API call from the dashboard will refresh the slide for real.
 */
export async function setActingAsCookie(organizationId: string): Promise<void> {
  try {
    const store = await cookies();
    store.set(ACTING_AS_COOKIE, organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACTING_AS_TTL_SECONDS,
    });
  } catch {
    // Called from a Server Component — write is a no-op, slide refresh will
    // happen on the next API call. This matches the pattern Next.js uses in
    // lib/supabase/server.ts for the same reason.
  }
}

/**
 * Clear the acting-as cookie. Used by the exit action and by any helper
 * that detects an invalid impersonation state (fail closed).
 *
 * Same Server-Component caveat as `setActingAsCookie`: writes are silently
 * no-op in Server Components and the next mutation context will clear it.
 */
export async function clearActingAsCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.set(ACTING_AS_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } catch {
    // No-op in Server Component contexts. See setActingAsCookie above.
  }
}

/**
 * Resolve the impersonation context for a given user.
 *
 * Validation rules (all must pass):
 *   1. The acting-as cookie is present and shaped like a UUID.
 *   2. The caller is currently flagged as `is_superadmin = true` in profiles.
 *   3. The target organization actually exists.
 *
 * If any check fails the cookie is cleared and `null` is returned. On
 * success the cookie's TTL is refreshed (sliding session).
 *
 * @param userId The currently authenticated auth.users id.
 * @returns The impersonation context, or null if no valid impersonation.
 */
export async function resolveActingAsForUser(
  userId: string,
): Promise<ActingAsContext | null> {
  const orgId = await readActingAsCookie();
  if (!orgId) return null;

  const admin = createAdminClient();

  // Re-verify superadmin status on every request — never trust the cookie alone.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_superadmin')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile?.is_superadmin) {
    await clearActingAsCookie();
    return null;
  }

  // Verify the target org exists. If it was deleted while impersonating,
  // bail out cleanly.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !org) {
    await clearActingAsCookie();
    return null;
  }

  // Refresh the sliding TTL on every validated request.
  await setActingAsCookie(orgId);

  return {
    organizationId: org.id,
    organizationName: org.name ?? null,
    organizationSlug: org.slug ?? null,
  };
}

/**
 * Append a row to the superadmin audit log. Uses the service_role client
 * because the table is write-only via RLS for non-service callers.
 *
 * Failures are logged but never thrown — audit logging must never block
 * the actual user-facing operation. (We accept the trade-off: a missed
 * audit row is preferable to a 500 on enter/exit.)
 */
export async function logSuperadminAction(params: {
  superadminId: string;
  action: 'enter' | 'exit' | 'denied';
  targetOrganizationId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('superadmin_audit_log').insert({
      superadmin_id: params.superadminId,
      action: params.action,
      target_organization_id: params.targetOrganizationId,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.error('[superadmin-audit] failed to write audit row:', error.message);
    }
  } catch (err) {
    console.error('[superadmin-audit] unexpected error writing audit row:', err);
  }
}

/**
 * Convenience: build an admin Supabase client. Re-exported here so callers
 * that already import the acting-as helpers don't need a second import.
 */
export function getAdminClient(): SupabaseClient {
  return createAdminClient();
}
