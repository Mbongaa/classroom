/**
 * API Route Authentication Guards
 *
 * Helper functions to protect API routes with authentication and role-based access control.
 * Use these in API route handlers to ensure only authorized users can access endpoints.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser, type ActingAsContext } from '@/lib/superadmin/acting-as';
import { NextResponse } from 'next/server';

export type AuthResult =
  | {
      success: true;
      user: any;
      supabase: any;
      profile?: any;
      /**
       * Set when a superadmin is currently impersonating an organization.
       * When present, `supabase` is the admin (service_role) client and
       * `profile.organization_id` has been overridden to the impersonated org.
       */
      actingAs?: ActingAsContext | null;
    }
  | { success: false; response: NextResponse };

/**
 * If the caller is a superadmin AND has an active acting-as cookie that
 * validates, return an impersonation overlay: an admin Supabase client
 * (RLS-bypass) and a profile with organization_id swapped to the impersonated
 * org. Otherwise returns null.
 *
 * Centralised here so requireTeacher/requireAdmin/requireOrgAdmin all behave
 * identically when impersonation is active.
 */
async function applyImpersonation(
  user: any,
  profile: any,
): Promise<{ supabase: any; profile: any; actingAs: ActingAsContext } | null> {
  if (!profile?.is_superadmin) return null;

  const actingAs = await resolveActingAsForUser(user.id);
  if (!actingAs) return null;

  return {
    supabase: createAdminClient(),
    profile: { ...profile, organization_id: actingAs.organizationId },
    actingAs,
  };
}

/**
 * Require authentication for API route
 * Returns user and supabase client or 401 error response
 *
 * @example
 * export async function GET() {
 *   const auth = await requireAuth()
 *   if (!auth.success) return auth.response
 *
 *   // Use auth.user and auth.supabase
 * }
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 },
      ),
    };
  }

  return {
    success: true,
    user,
    supabase,
  };
}

/**
 * Require teacher or admin role for API route
 * Returns user, profile, and supabase client or 401/403 error response
 *
 * @example
 * export async function POST() {
 *   const auth = await requireTeacher()
 *   if (!auth.success) return auth.response
 *
 *   // User is authenticated and has teacher/admin role
 * }
 */
export async function requireTeacher(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  // Fetch user profile with role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, organization_id, is_superadmin')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    };
  }

  // Check if user has teacher or admin role (superadmins always pass)
  if (!['teacher', 'admin'].includes(profile.role) && !profile.is_superadmin) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden - Teacher or admin role required' },
        { status: 403 },
      ),
    };
  }

  // If a superadmin is impersonating an org, override the org context
  // and swap to the admin client so all downstream queries see the
  // impersonated tenant's data without RLS pushback.
  const impersonation = await applyImpersonation(user, profile);
  if (impersonation) {
    return {
      success: true,
      user,
      supabase: impersonation.supabase,
      profile: impersonation.profile,
      actingAs: impersonation.actingAs,
    };
  }

  return {
    success: true,
    user,
    supabase,
    profile,
  };
}

/**
 * Require admin role for API route
 * Returns user, profile, and supabase client or 401/403 error response
 *
 * @example
 * export async function DELETE() {
 *   const auth = await requireAdmin()
 *   if (!auth.success) return auth.response
 *
 *   // User is authenticated and has admin role
 * }
 */
export async function requireAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  // Fetch user profile with role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, organization_id, is_superadmin')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    };
  }

  // Check if user has admin role (superadmins always pass)
  if (profile.role !== 'admin' && !profile.is_superadmin) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Forbidden - Admin role required' }, { status: 403 }),
    };
  }

  // Honor superadmin "act as organization" impersonation.
  const impersonation = await applyImpersonation(user, profile);
  if (impersonation) {
    return {
      success: true,
      user,
      supabase: impersonation.supabase,
      profile: impersonation.profile,
      actingAs: impersonation.actingAs,
    };
  }

  return {
    success: true,
    user,
    supabase,
    profile,
  };
}

/**
 * Require superadmin access for API route
 * Returns user, profile, and supabase client or 401/403 error response
 *
 * @example
 * export async function GET() {
 *   const auth = await requireSuperAdmin()
 *   if (!auth.success) return auth.response
 *
 *   // User is authenticated and is a platform superadmin
 * }
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  // Fetch user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, organization_id, is_superadmin')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }),
    };
  }

  if (!profile.is_superadmin) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden - Superadmin access required' },
        { status: 403 },
      ),
    };
  }

  return {
    success: true,
    user,
    supabase,
    profile,
  };
}

/**
 * Require organization member access
 * Validates that user belongs to the specified organization
 *
 * @param organizationId - The organization ID to check membership for
 */
export async function requireOrgMember(organizationId: string): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  // Check if user is member of the organization
  const { data: member, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (error || !member) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden - Not a member of this organization' },
        { status: 403 },
      ),
    };
  }

  return {
    success: true,
    user,
    supabase,
    profile: member,
  };
}

/**
 * Allowed roles for an organization admin guard on Pay.nl-related endpoints.
 * Maps onto the existing organization_members.role enum.
 */
export type OrgRole = 'admin' | 'teacher' | 'student';

/**
 * Require organization admin / member access for API route.
 *
 * Checks that the authenticated user either:
 *   1. has a row in `organization_members` for the given organization with
 *      an allowed role, OR
 *   2. is a platform superadmin (bypasses org membership checks).
 *
 * @param organizationId - The organization ID to check membership for
 * @param allowedRoles - Which org roles are permitted (default: ['admin'])
 *
 * @example
 * export async function POST(request: NextRequest, { params }) {
 *   const { id } = await params;
 *   const auth = await requireOrgAdmin(id);
 *   if (!auth.success) return auth.response;
 *   // auth.profile.role is the user's org role (or 'superadmin')
 * }
 */
export async function requireOrgAdmin(
  organizationId: string,
  allowedRoles: OrgRole[] = ['admin'],
): Promise<AuthResult> {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  // Superadmins bypass org-scoped checks entirely.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single();

  if (profile?.is_superadmin) {
    // If a superadmin is impersonating an org, return the admin client and
    // surface the impersonation context. The org-scoped check itself is
    // already bypassed for superadmins, so the requested organizationId
    // remains the authoritative scope for this call (callers pass the
    // org id they want to act on).
    const impersonation = await applyImpersonation(user, profile);
    if (impersonation) {
      return {
        success: true,
        user,
        supabase: impersonation.supabase,
        profile: { role: 'superadmin', organization_id: organizationId },
        actingAs: impersonation.actingAs,
      };
    }
    return {
      success: true,
      user,
      supabase,
      profile: { role: 'superadmin', organization_id: organizationId },
    };
  }

  // Check org membership + role.
  const { data: member, error } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (error || !member) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden - Not a member of this organization' },
        { status: 403 },
      ),
    };
  }

  if (!allowedRoles.includes(member.role as OrgRole)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: `Forbidden - Org role '${member.role}' not permitted (requires one of: ${allowedRoles.join(', ')})`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    success: true,
    user,
    supabase,
    profile: member,
  };
}
