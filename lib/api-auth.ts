/**
 * API Route Authentication Guards
 *
 * Helper functions to protect API routes with authentication and role-based access control.
 * Use these in API route handlers to ensure only authorized users can access endpoints.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export type AuthResult =
  | { success: true; user: any; supabase: any; profile?: any }
  | { success: false; response: NextResponse };

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
