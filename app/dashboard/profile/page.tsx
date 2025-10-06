'use client';

import { useUser } from '@/lib/contexts/UserContext';
import { ProfileForm } from '@/app/dashboard/profile/profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function ProfilePage() {
  const { user, profile, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!user || !profile) {
    return <div className="text-black dark:text-white">Not authenticated</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">Profile Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details and profile picture</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-black dark:text-white">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">Role</p>
              <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">Organization</p>
              <p className="text-sm text-muted-foreground">{profile.organization?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">Member Since</p>
              <p className="text-sm text-muted-foreground">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
