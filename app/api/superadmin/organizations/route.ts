import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const supabaseAdmin = createAdminClient();

  // Fetch all organizations with member and classroom counts
  const { data: organizations, error } = await supabaseAdmin
    .from('organizations')
    .select(
      `
      id,
      name,
      slug,
      subscription_tier,
      subscription_status,
      created_at,
      members:organization_members(count),
      classrooms:classrooms(count)
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the count aggregates
  const orgs = (organizations ?? []).map((org: any) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    subscription_tier: org.subscription_tier,
    subscription_status: org.subscription_status,
    created_at: org.created_at,
    member_count: org.members?.[0]?.count ?? 0,
    classroom_count: org.classrooms?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ organizations: orgs });
}
