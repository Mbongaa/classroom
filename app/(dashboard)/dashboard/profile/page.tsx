'use client';

import { useTranslations } from 'next-intl';
import { useUser } from '@/lib/contexts/UserContext';
import { ProfileForm } from './profile-form';
import { OrganizationForm } from './organization-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function ProfilePage() {
  const { user, profile, loading } = useUser();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!user || !profile) {
    return <div className="text-black dark:text-white">{tCommon('notAuthenticated')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
          {t('title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('personal.title')}</CardTitle>
            <CardDescription>{t('personal.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('account.title')}</CardTitle>
            <CardDescription>{t('account.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-black dark:text-white">{t('account.email')}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">{t('account.role')}</p>
              <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">
                {t('account.organization')}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile.organization?.name || t('account.organizationFallback')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-black dark:text-white">
                {t('account.memberSince')}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {profile.role === 'admin' && profile.organization && (
          <Card>
            <CardHeader>
              <CardTitle>{t('organization.title')}</CardTitle>
              <CardDescription>{t('organization.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <OrganizationForm currentName={profile.organization.name} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
