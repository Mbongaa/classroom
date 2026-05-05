import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';

export interface V2AuthenticatedUserContext {
  userId: string;
  role: string;
  isSuperadmin: boolean;
  organizationId: string | null;
}

export async function getV2AuthenticatedUserContext(
  userId: string,
): Promise<V2AuthenticatedUserContext | null> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, organization_id, is_superadmin')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) return null;

  const actingAs = profile.is_superadmin ? await resolveActingAsForUser(userId) : null;

  return {
    userId,
    role: profile.role,
    isSuperadmin: Boolean(profile.is_superadmin),
    organizationId: actingAs?.organizationId ?? profile.organization_id ?? null,
  };
}

export function canHostClassroom(
  context: V2AuthenticatedUserContext | null,
  classroom: { organization_id: string },
): boolean {
  if (!context?.organizationId || context.organizationId !== classroom.organization_id) {
    return false;
  }
  return context.isSuperadmin || context.role === 'teacher' || context.role === 'admin';
}
