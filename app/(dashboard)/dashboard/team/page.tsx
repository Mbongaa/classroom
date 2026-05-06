import { redirect } from 'next/navigation';
import { Shield, UserPlus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';
import { getFinanceAccessForOrganization } from '@/lib/finance-access';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamInviteForm } from './TeamInviteForm';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: 'admin' | 'teacher' | 'student';
  joined_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  expires_at: string;
  created_at: string;
}

function formatRole(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'teacher') return 'Teacher';
  return 'Student';
}

function roleDescription(role: string) {
  if (role === 'admin') return 'Translation and finance';
  if (role === 'teacher') return 'Translation only';
  return 'Limited access';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/team');
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
    redirect('/dashboard');
  }

  const access = await getFinanceAccessForOrganization(user.id, organizationId, admin);
  if (!access.canAccessFinance) {
    redirect('/dashboard');
  }

  const profileOrg = Array.isArray(profile?.organization)
    ? profile?.organization[0]
    : profile?.organization;

  const organization: OrganizationRow | null = actingAs
    ? {
        id: actingAs.organizationId,
        name: actingAs.organizationName,
        slug: actingAs.organizationSlug,
      }
    : profileOrg
      ? {
          id: profileOrg.id,
          name: profileOrg.name,
          slug: profileOrg.slug,
        }
      : null;

  if (!organization) {
    redirect('/dashboard');
  }

  const [{ data: members }, { data: invitations }] = await Promise.all([
    admin
      .from('organization_members')
      .select<string, MemberRow>(
        'id, user_id, role, joined_at, profiles(id, full_name, avatar_url)',
      )
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true }),
    admin
      .from('invitations')
      .select<string, InvitationRow>('id, email, role, expires_at, created_at')
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const memberRows = members ?? [];
  const pendingInvitations = (invitations ?? []).filter(
    (invite) => new Date(invite.expires_at).getTime() >= Date.now(),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div>
        <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Organization team
        </p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-black dark:text-white">
          {organization.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Invite staff into this same organization. Teachers get translation only; admins get
          translation, billing, and finance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-900">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Invite team member</CardTitle>
              <CardDescription>Default to Teacher for translation-only access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TeamInviteForm />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Current users</CardTitle>
                <CardDescription>{memberRows.length} users in this organization</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(128,128,128,0.25)] text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Access</th>
                    <th className="px-3 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-[rgba(128,128,128,0.12)] last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-black dark:text-white">
                          {member.profiles?.full_name || 'Unnamed user'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {member.user_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                          {formatRole(member.role)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {roleDescription(member.role)}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(member.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5" />
              <div>
                <CardTitle>Pending invites</CardTitle>
                <CardDescription>{pendingInvitations.length} active invitations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No pending invitations.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-md border border-[rgba(128,128,128,0.2)] p-3"
                  >
                    <div className="font-medium text-black dark:text-white">{invite.email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={invite.role === 'admin' ? 'default' : 'secondary'}>
                        {formatRole(invite.role)}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Expires {formatDate(invite.expires_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
