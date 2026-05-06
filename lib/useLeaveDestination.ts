'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * localStorage key for the post-call donation redirect feature.
 * Value `'1'` = on, key absent = off. Set + cleared by the dashboard
 * Settings toggle.
 */
export const KIOSK_REDIRECT_ENABLED_KEY = 'bayaan:kiosk-redirect-enabled';
export const POST_CALL_REDIRECT_PARAM = 'postCallRedirect';

export function readKioskRedirectEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KIOSK_REDIRECT_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function readPostCallRedirectEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const value = new URL(window.location.href).searchParams.get(POST_CALL_REDIRECT_PARAM);
  return value === 'true' || value === '1';
}

function readUrlOrgSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get('org');
}

function isMobileDonationTarget(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 768px)').matches ||
    /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent)
  );
}

function buildDonationDestination(slug: string): string {
  return isMobileDonationTarget() ? `/donate/${slug}` : `/kiosk/${slug}`;
}

/**
 * Where a participant should land after they leave a room.
 *
 * If post-call donation redirect is enabled for this browser or room link,
 * participants land on `/kiosk/<slug>` on desktop and `/donate/<slug>` on
 * phones. Otherwise signed-in teachers return to `/dashboard`, while
 * anonymous teachers and students go back to `/`.
 */
export function useLeaveDestination(userRole?: string | null): string {
  const [destination, setDestination] = useState<string>('/');

  useEffect(() => {
    let cancelled = false;
    const redirectEnabled = readKioskRedirectEnabled() || readPostCallRedirectEnabled();
    const urlOrgSlug = readUrlOrgSlug();

    if (redirectEnabled && urlOrgSlug) {
      setDestination(buildDonationDestination(urlOrgSlug));
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;

      if (redirectEnabled && session) {
        try {
          const res = await fetch('/api/me', { cache: 'no-store' });
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            const slug: string | undefined = data?.profile?.organization?.slug;
            if (slug) {
              setDestination(buildDonationDestination(slug));
              return;
            }
          }
        } catch {
          // Fall through to the normal role-based fallback.
        }
      }

      if (userRole !== 'teacher') {
        setDestination('/');
        return;
      }

      setDestination(session ? '/dashboard' : '/');
    });

    return () => {
      cancelled = true;
    };
  }, [userRole]);

  return destination;
}
