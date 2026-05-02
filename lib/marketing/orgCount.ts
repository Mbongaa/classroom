import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Minimum number we surface as social proof while the table is small or if
 * the query fails. Prevents an embarrassing "0 masjids" or "1 masjid" if the
 * count is briefly unavailable.
 */
const FLOOR = 7;

/**
 * Live count of registered organizations on Bayaan, used as social proof in
 * the auth left pane ("7 masjids already on Bayaan").
 *
 * Cached for 5 minutes so the auth page doesn't hit Supabase on every render.
 * Falls back to FLOOR on any error so the page never breaks.
 */
export const getOrganizationCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const supabase = createAdminClient();
      const { count, error } = await supabase
        .from('organizations')
        .select('id', { count: 'exact', head: true });
      if (error) {
        console.error('[orgCount] failed:', error);
        return FLOOR;
      }
      return Math.max(count ?? 0, FLOOR);
    } catch (err) {
      console.error('[orgCount] error:', err);
      return FLOOR;
    }
  },
  ['marketing-org-count'],
  { revalidate: 300, tags: ['marketing-org-count'] },
);
