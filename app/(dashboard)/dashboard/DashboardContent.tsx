'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Classroom } from '@/lib/types';
import { generateRoomId } from '@/lib/client-utils';
import { Video, ArrowRight, Monitor, ExternalLink } from 'lucide-react';
import { LottieIcon } from '@/components/lottie-icon';

interface DashboardContentProps {
  userName: string;
  classroomCount: number;
  organizationName: string;
  organizationSlug?: string;
  rooms: Classroom[];
}

export function DashboardContent({
  userName,
  classroomCount,
  organizationName,
  organizationSlug,
  rooms,
}: DashboardContentProps) {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  const startKhutbaQuickstart = () => {
    const params = new URLSearchParams({
      speech: 'true',
      role: 'teacher',
      quickstart: 'khutba',
      speakerLanguage: 'ar',
      translationLanguage: 'nl',
    });
    if (organizationSlug) {
      params.set('org', organizationSlug);
    }
    router.push(`/rooms/${generateRoomId()}?${params.toString()}`);
  };

  const kioskHref = organizationSlug ? `/kiosk/${organizationSlug}` : null;

  const stats = [
    {
      title: t('stats.activeClassrooms'),
      value: classroomCount || 0,
      description: t('stats.activeClassroomsDescription'),
      link: '/dashboard/classrooms',
    },
    {
      title: t('stats.organization'),
      value: organizationName || t('stats.organizationFallback'),
      description: t('stats.organizationDescription'),
      link: '/dashboard/organization',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
          {t('welcome', { name: userName })}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black dark:text-white">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.link && (
                <Link href={stat.link}>
                  <Button variant="link" className="px-0 mt-2" size="sm">
                    {tCommon('viewAll')} →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.kiosk')}</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-black dark:text-white">
              {organizationSlug || t('stats.organizationFallback')}
            </div>
            <p className="text-xs text-muted-foreground">
              {kioskHref ? t('stats.kioskDescription') : t('stats.kioskFallback')}
            </p>
            {kioskHref && (
              <a href={kioskHref} target="_blank" rel="noopener noreferrer">
                <Button variant="link" className="px-0 mt-2" size="sm">
                  {t('stats.openKiosk')}
                  <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('quickActions.title')}</CardTitle>
            <CardDescription>{t('quickActions.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-black dark:text-white" style={{ margin: '0 0 1rem 0' }}>
              {t('quickActions.intro')}
            </p>

            <div className="flex w-full justify-center">
              <button
                onClick={startKhutbaQuickstart}
                className="group inline-flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-black px-5 py-3 text-2xl font-bold text-white shadow-lg ring-offset-2 transition duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-black hover:ring-offset-white active:scale-[0.99] sm:text-3xl dark:bg-white dark:text-black dark:hover:ring-white dark:ring-offset-black"
              >
                {/* Source .lottie has an 800x800 canvas with the mic artwork
                    only occupying the center ~half. Oversize the inner Lottie
                    and clip the empty canvas padding with overflow-hidden so
                    the centered artwork fills the visible viewport. */}
                <span
                  aria-hidden="true"
                  className="relative h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16"
                >
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <LottieIcon src="/lottie/microphone-record.lottie" size={120} />
                  </span>
                </span>
                <span>{t('quickActions.khutbaQuickstart')}</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('recentRooms.title')}</CardTitle>
                <CardDescription>{t('recentRooms.description')}</CardDescription>
              </div>
              <Link href="/dashboard/rooms">
                <Button variant="ghost" size="sm" className="gap-1">
                  {tCommon('viewAll')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">{t('recentRooms.empty')}</p>
                <Link href="/dashboard/rooms">
                  <Button size="sm">{t('recentRooms.createFirst')}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push('/dashboard/rooms')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-black dark:text-white truncate">
                          {room.room_code}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {room.room_type === 'classroom'
                            ? t('recentRooms.types.classroom')
                            : room.room_type === 'speech'
                              ? t('recentRooms.types.speech')
                              : t('recentRooms.types.meeting')}
                        </Badge>
                      </div>
                      {room.name && (
                        <p className="text-sm text-muted-foreground truncate">{room.name}</p>
                      )}
                    </div>
                    <Video className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
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
