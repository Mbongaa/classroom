'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';
import { getFinanceAccessForOrganization, type OrganizationRole } from '@/lib/finance-access';
import { sendEmail } from '@/lib/email/email-service';
import { TeamInviteEmail } from '@/lib/email/templates/TeamInviteEmail';

type InviteRole = Extract<OrganizationRole, 'admin' | 'teacher'>;

interface InviteMemberResult {
  success: boolean;
  error?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function roleLabel(role: InviteRole) {
  return role === 'admin' ? 'Admin (translation and finance)' : 'Teacher (translation only)';
}

function confirmUrlForInvite(baseUrl: string, tokenHash: string, type: string, nextPath: string) {
  return `${baseUrl}/api/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(nextPath)}`;
}

export async function inviteOrganizationMember(
  formData: FormData,
): Promise<InviteMemberResult> {
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();
  const role = formData.get('role') as InviteRole | null;

  if (!EMAIL_RE.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  if (role !== 'admin' && role !== 'teacher') {
    return { success: false, error: 'Choose a valid team role.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to invite team members.' };
  }
  if (user.email?.toLowerCase() === email) {
    return { success: false, error: 'You are already a member of this organization.' };
  }

  const admin = createAdminClient();
  const actingAs = await resolveActingAsForUser(user.id);
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, organization:organizations(id, name, slug)')
    .eq('id', user.id)
    .single();

  const organizationId = actingAs?.organizationId ?? profile?.organization_id;
  if (!organizationId) {
    return { success: false, error: 'No organization found for this account.' };
  }

  const access = await getFinanceAccessForOrganization(user.id, organizationId, admin);
  if (!access.canAccessFinance) {
    return { success: false, error: 'Only organization admins can invite team members.' };
  }

  const profileOrg = Array.isArray(profile?.organization)
    ? profile?.organization[0]
    : profile?.organization;
  const organization =
    actingAs ??
    (profileOrg
      ? {
          organizationId: profileOrg.id,
          organizationName: profileOrg.name,
          organizationSlug: profileOrg.slug,
        }
      : null);

  if (!organization) {
    return { success: false, error: 'Organization details could not be loaded.' };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: invitationError } = await admin
    .from('invitations')
    .upsert(
      {
        organization_id: organizationId,
        email,
        role,
        invited_by: user.id,
        expires_at: expiresAt,
        accepted_at: null,
      },
      { onConflict: 'organization_id,email' },
    )
    .select('id')
    .single();

  if (invitationError || !invitation) {
    return {
      success: false,
      error: invitationError?.message || 'Could not create the invitation.',
    };
  }

  const baseUrl = appBaseUrl();
  const nextPath = `/api/invitations/accept?id=${encodeURIComponent(invitation.id)}`;
  const redirectTo = `${baseUrl}${nextPath}`;
  const metadata = {
    invited_organization_id: organizationId,
    invited_organization_name: organization.organizationName,
    invited_role: role,
  };

  let linkResult = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: metadata,
      redirectTo,
    },
  });

  if (linkResult.error && /already|registered|exists/i.test(linkResult.error.message)) {
    linkResult = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: metadata,
        redirectTo,
      },
    });
  }

  if (linkResult.error || !linkResult.data.properties) {
    return {
      success: false,
      error: linkResult.error?.message || 'Could not generate an invitation link.',
    };
  }

  const inviteUrl = confirmUrlForInvite(
    baseUrl,
    linkResult.data.properties.hashed_token,
    linkResult.data.properties.verification_type,
    nextPath,
  );

  try {
    await sendEmail({
      to: email,
      subject: `You are invited to ${organization.organizationName} on Bayaan`,
      react: TeamInviteEmail({
        organizationName: organization.organizationName,
        inviteUrl,
        roleLabel: roleLabel(role),
      }),
      tags: [{ name: 'type', value: 'team_invite' }],
    });
  } catch (err) {
    console.error('[Team] Failed to send invitation email', err);
    return { success: false, error: 'Invitation created, but the email could not be sent.' };
  }

  revalidatePath('/dashboard/team');
  return {
    success: true,
    message: `${email} was invited as ${roleLabel(role)}.`,
  };
}
