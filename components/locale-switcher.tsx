'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setLocale } from '@/app/actions/locale';
import { locales, localeLabels, type Locale } from '@/i18n/config';

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('locale');
  const [isPending, startTransition] = React.useTransition();

  function onChange(value: string) {
    if (value === locale) return;
    startTransition(async () => {
      await setLocale(value as Locale);
    });
  }

  return (
    <Select value={locale} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger
        aria-label={t('switchLanguage')}
        className="h-9 w-auto min-w-[120px] gap-2 border-transparent bg-transparent px-3 py-0 text-sm hover:bg-accent hover:text-accent-foreground focus:ring-0 focus:ring-offset-0"
      >
        <Globe className="h-4 w-4 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((l) => (
          <SelectItem key={l} value={l}>
            {localeLabels[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
