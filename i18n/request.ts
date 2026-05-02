import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME, type Locale } from './config';

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const headerList = await headers();
  const acceptLanguage = headerList.get('accept-language') ?? '';
  const primary = acceptLanguage.split(',')[0]?.trim().split('-')[0];
  if (isLocale(primary)) return primary;

  return defaultLocale;
}

/**
 * Deep-merge `b` over `a`. Used to layer the active-locale messages on top
 * of the default-locale messages so any key missing from a translation
 * falls back to English at render time instead of throwing
 * `MISSING_MESSAGE` and crashing the section.
 */
function deepMerge<T extends Record<string, unknown>>(a: T, b: T): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof out[k] === 'object' &&
      out[k] !== null &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(
        out[k] as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const localeMessages = (await import(`../messages/${locale}.json`)).default;

  // Layer the active locale on top of English so any missing key falls back
  // to English at render time. Without this, a missing key throws
  // `MISSING_MESSAGE` and React aborts the subtree — which is what was
  // turning the marketing landing into a black screen on browsers with
  // non-English locales (nl/de/fr/ar) before the translation files were
  // brought up to date.
  if (locale === defaultLocale) {
    return { locale, messages: localeMessages };
  }

  const defaultMessages = (await import(`../messages/${defaultLocale}.json`)).default;
  const messages = deepMerge(defaultMessages, localeMessages);
  return { locale, messages };
});
