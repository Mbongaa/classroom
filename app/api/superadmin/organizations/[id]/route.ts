import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  // 1. Fetch all user IDs belonging to this org (before CASCADE deletes profiles)
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('organization_id', id);

  if (profilesError) {
    return NextResponse.json(
      { error: `Failed to fetch org profiles: ${profilesError.message}` },
      { status: 500 },
    );
  }

  // 2. Delete the organization row — CASCADE handles:
  //    profiles, organization_members, classrooms (→ classroom_participants),
  //    invitations, translation_prompt_templates
  //    SET NULL handles: sessions.organization_id, session_recordings.classroom_id
  const { error: deleteError } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete organization: ${deleteError.message}` },
      { status: 500 },
    );
  }

  // 3. Delete auth.users to prevent orphaned accounts
  let deletedUsers = 0;
  const userErrors: string[] = [];

  for (const profile of profiles ?? []) {
    const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (userError) {
      userErrors.push(`User ${profile.id}: ${userError.message}`);
    } else {
      deletedUsers++;
    }
  }

  return NextResponse.json({
    success: true,
    deletedUsers,
    ...(userErrors.length > 0 && { userErrors }),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.success) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const supabaseAdmin = createAdminClient();

  const allowedFields = ['name', 'slug', 'subscription_tier', 'subscription_status'];
  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate slug uniqueness if changed
  if (updates.slug) {
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', updates.slug)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to update organization: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization: data });
}
