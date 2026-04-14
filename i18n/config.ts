export const locales = ['en', 'ar', 'nl', 'fr', 'de'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export const rtlLocales = new Set<Locale>(['ar']);

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  nl: 'Nederlands',
  fr: 'Français',
  de: 'Deutsch',
};

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return rtlLocales.has(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
