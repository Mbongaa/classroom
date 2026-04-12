import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';

// Force dynamic execution so that `refetch()` after a server-action
// revalidatePath always sees the fresh profile/org row instead of a
// cached response from the previous render.
export const dynamic = 'force-dynamic';

/**
 * GET /api/me — return the current user + profile, with impersonation applied.
 *
 * This is the single source of truth that the client-side UserContext uses
 * to populate the dashboard. When a superadmin is acting as an organization,
 * the returned `organization_id` and joined `organization` reflect the
 * impersonated tenant, so every UI surface that reads from `useUser()`
 * (settings, home, sidebar, header, etc.) renders the impersonated org's
 * context — not the real superadmin's home org.
 *
 * Identity fields (`id`, `is_superadmin`) are preserved as-is so the user
 * stays able to navigate to /superadmin/* and exit impersonation.
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user } = auth;

  // Always read the real profile via the admin client so this works
  // identically whether or not impersonation is active.
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select(
      `
      *,
      organization:organizations(*)
    `,
    )
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // If a superadmin is impersonating, swap the org context to the
  // impersonated organization. We fetch the impersonated org with the same
  // shape as the joined `organization` field so client code doesn't need to
  // distinguish between real and impersonated profiles.
  const actingAs = await resolveActingAsForUser(user.id);
  if (actingAs) {
    const { data: impersonatedOrg } = await admin
      .from('organizations')
      .select('*')
      .eq('id', actingAs.organizationId)
      .single();

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile: {
        ...profile,
        organization_id: actingAs.organizationId,
        organization: impersonatedOrg ?? profile.organization,
      },
      actingAs: {
        organizationId: actingAs.organizationId,
        organizationName: actingAs.organizationName,
        organizationSlug: actingAs.organizationSlug,
      },
    });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
    actingAs: null,
  });
}
