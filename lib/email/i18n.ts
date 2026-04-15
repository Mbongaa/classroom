import { createTranslator } from 'next-intl';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { createAdminClient } from '@/lib/supabase/admin';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import nl from '@/messages/nl.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';

const messagesByLocale: Record<Locale, unknown> = { en, ar, nl, fr, de };

/**
 * Build a synchronous translator for transactional emails.
 *
 * Uses `createTranslator` (not `getTranslations`) because email templates
 * render as React trees inside webhook routes that don't carry request
 * locale context — we resolve the recipient's org locale manually and pass
 * it in, so the translator must be fully standalone.
 */
export function getEmailTranslator(locale: Locale, namespace: string) {
  return createTranslator({
    locale,
    messages: messagesByLocale[locale] as Parameters<typeof createTranslator>[0]['messages'],
    namespace,
  });
}

/**
 * Coerce an arbitrary string (e.g. from the database) to a supported Locale,
 * falling back to the platform default. Keeps template call sites from
 * needing to think about the invariant.
 */
export function resolveEmailLocale(raw: string | null | undefined): Locale {
  return isLocale(raw ?? undefined) ? (raw as Locale) : defaultLocale;
}

/**
 * Resolve the transactional-email locale for a given auth user.
 *
 * Follows the user → profile → organization → preferred_locale chain using the
 * admin client (these webhooks run without a request session). Failures fall
 * back to `defaultLocale` — a missing profile or org shouldn't block the send.
 */
export async function getEmailLocaleForUser(userId: string): Promise<Locale> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();

    const orgId = profile?.organization_id;
    if (!orgId) return defaultLocale;

    const { data: org } = await admin
      .from('organizations')
      .select('preferred_locale')
      .eq('id', orgId)
      .maybeSingle();

    return resolveEmailLocale(org?.preferred_locale);
  } catch (err) {
    console.error('[email-locale] Failed to resolve locale for user:', userId, err);
    return defaultLocale;
  }
}
