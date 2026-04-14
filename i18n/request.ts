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

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
