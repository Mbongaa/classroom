'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Classroom } from '@/lib/types';
import { generateRoomId } from '@/lib/client-utils';
import {
  KIOSK_REDIRECT_ENABLED_KEY,
  POST_CALL_REDIRECT_PARAM,
} from '@/lib/useLeaveDestination';
import { cn } from '@/lib/utils';
import { Video, ArrowRight, Monitor, ExternalLink, Loader2 } from 'lucide-react';
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
  const [isStartingKhutba, setIsStartingKhutba] = useState(false);

  // Post-call kiosk redirect toggle. Boolean flag only —
  // `useLeaveDestination` resolves the org slug from /api/me at leave-time.
  // Default off; the toggle is visible to every signed-in user.
  const [kioskRedirectOn, setKioskRedirectOn] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setKioskRedirectOn(window.localStorage.getItem(KIOSK_REDIRECT_ENABLED_KEY) === '1');
    } catch {
      // localStorage can throw in private mode / storage-denied — treat as off.
    }
  }, []);

  const handleKioskRedirectToggle = (next: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      if (next) {
        window.localStorage.setItem(KIOSK_REDIRECT_ENABLED_KEY, '1');
      } else {
        window.localStorage.removeItem(KIOSK_REDIRECT_ENABLED_KEY);
      }
      setKioskRedirectOn(next);
    } catch {
      // Storage denied — silently ignore so the dashboard doesn't break.
    }
  };

  const startKhutbaQuickstart = () => {
    if (isStartingKhutba) return; // guard against double-click / re-entry
    setIsStartingKhutba(true);
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
    if (kioskRedirectOn && organizationSlug) {
      params.set(POST_CALL_REDIRECT_PARAM, 'true');
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
                disabled={isStartingKhutba}
                aria-busy={isStartingKhutba}
                className="group inline-flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-black px-5 py-3 text-2xl font-bold text-white shadow-lg ring-offset-2 transition duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-black hover:ring-offset-white active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100 disabled:hover:ring-0 sm:text-3xl dark:bg-white dark:text-black dark:hover:ring-white dark:ring-offset-black"
              >
                {isStartingKhutba ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 animate-spin sm:h-12 sm:w-12"
                    />
                    <span>{t('quickActions.khutbaQuickstartStarting')}</span>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                    className="flex items-center justify-between p-3 rounded-lg border border-[rgba(128,128,128,0.3)] hover:bg-accent/50 transition-colors cursor-pointer"
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

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            role="switch"
            aria-checked={kioskRedirectOn}
            aria-labelledby="kiosk-redirect-title"
            aria-describedby="kiosk-redirect-description"
            onClick={() => handleKioskRedirectToggle(!kioskRedirectOn)}
            className="group flex w-full items-center justify-between gap-6 rounded-lg border border-[rgba(128,128,128,0.3)] bg-background p-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="min-w-0 flex-1">
              <div
                id="kiosk-redirect-title"
                className="text-sm font-medium text-black dark:text-white"
              >
                {t('settings.kioskRedirect.title')}
              </div>
              <p id="kiosk-redirect-description" className="mt-1 text-sm text-muted-foreground">
                {t('settings.kioskRedirect.description')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={cn(
                  'hidden rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide sm:inline-flex',
                  kioskRedirectOn
                    ? 'border-white bg-white text-black'
                    : 'border-[rgba(128,128,128,0.35)] bg-transparent text-muted-foreground',
                )}
              >
                {kioskRedirectOn
                  ? t('settings.kioskRedirect.enabled')
                  : t('settings.kioskRedirect.disabled')}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full border border-[rgba(128,128,128,0.35)] transition-colors',
                  kioskRedirectOn ? 'bg-white' : 'bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'absolute h-5 w-5 rounded-full shadow transition-transform',
                    kioskRedirectOn
                      ? 'translate-x-6 bg-black'
                      : 'translate-x-1 bg-white dark:bg-zinc-600',
                  )}
                />
              </span>
            </div>
          </button>
        </CardContent>
      </Card>

    </div>
  );
}
