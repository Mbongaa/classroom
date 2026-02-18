import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Run all count queries in parallel
  const [orgsResult, usersResult, classroomsResult, activeSessionsResult] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('classrooms').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null),
  ]);

  return NextResponse.json({
    totalOrganizations: orgsResult.count ?? 0,
    totalUsers: usersResult.count ?? 0,
    totalClassrooms: classroomsResult.count ?? 0,
    activeSessions: activeSessionsResult.count ?? 0,
  });
}
