import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  expires_at: string;
  accepted_at: string | null;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const invitationId = request.nextUrl.searchParams.get('id');
  if (!invitationId) {
    return redirectTo(request, '/dashboard?invite=missing');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(
      request,
      `/login?redirect=${encodeURIComponent(`/api/invitations/accept?id=${invitationId}`)}`,
    );
  }

  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from('invitations')
    .select<string, InvitationRow>('id, organization_id, email, role, expires_at, accepted_at')
    .eq('id', invitationId)
    .single();

  if (error || !invitation) {
    return redirectTo(request, '/dashboard?invite=not-found');
  }

  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return redirectTo(request, '/dashboard?invite=wrong-email');
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return redirectTo(request, '/dashboard?invite=expired');
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.organization_id && profile.organization_id !== invitation.organization_id) {
    return redirectTo(request, '/dashboard?invite=different-org');
  }

  const fullName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    '';

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        organization_id: invitation.organization_id,
        full_name: fullName,
        role: invitation.role,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    console.error('[Invitations] Failed to update profile', profileError);
    return redirectTo(request, '/dashboard?invite=profile-error');
  }

  const { error: memberError } = await admin.from('organization_members').upsert(
    {
      organization_id: invitation.organization_id,
      user_id: user.id,
      role: invitation.role,
    },
    { onConflict: 'organization_id,user_id' },
  );

  if (memberError) {
    console.error('[Invitations] Failed to upsert membership', memberError);
    return redirectTo(request, '/dashboard?invite=membership-error');
  }

  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return redirectTo(request, '/dashboard?invite=accepted');
}
