'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Where a participant should land after they leave a room.
 *
 * Teachers (hosts) who are signed in go to `/dashboard` so they return to
 * their workspace. Anonymous teachers and students go back to `/` — the
 * dashboard layout would bounce an unauthenticated visitor to `/welcome`,
 * which isn't useful for a student who joined via a shared link.
 */
export function useLeaveDestination(userRole?: string | null): string {
  const [destination, setDestination] = useState<string>('/');

  useEffect(() => {
    if (userRole !== 'teacher') {
      setDestination('/');
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setDestination(session ? '/dashboard' : '/');
    });
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  return destination;
}
