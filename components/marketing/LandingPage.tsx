'use client';

import { useEffect } from 'react';
import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import { HeroWrapper } from '@/components/marketing/wrappers/HeroWrapper';
import { HowItWorksWrapper } from '@/components/marketing/wrappers/HowItWorksWrapper';
import { AnecdoteWrapper } from '@/components/marketing/wrappers/AnecdoteWrapper';
import { FeaturesWrapper } from '@/components/marketing/wrappers/FeaturesWrapper';
import { UseCasesWrapper } from '@/components/marketing/wrappers/UseCasesWrapper';
import { TestimonialsWrapper } from '@/components/marketing/wrappers/TestimonialsWrapper';
import { ContactWrapper } from '@/components/marketing/wrappers/ContactWrapper';
import { InTheRoomWrapper } from '@/components/marketing/wrappers/InTheRoomWrapper';
import { CTAWrapper } from '@/components/marketing/wrappers/CTAWrapper';

export function MarketingLandingPage() {
  // The sketch system is light-only, scoped under [data-mkt-root] with
  // hardcoded paper-palette variables. We deliberately do NOT call setTheme
  // so the user's dashboard dark-mode preference is preserved.
  //
  // Apply a `mkt-active` class to <html> while this page is mounted so
  // older browsers (Android Chrome < 105 doesn't support CSS `:has()`) can
  // unlock body scroll and force the cream/ink palette without the
  // dark-theme `--background` bleeding through. Removed on unmount so the
  // dashboard / product surfaces fall back to their normal theme.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mkt-active');
    return () => {
      root.classList.remove('mkt-active');
    };
  }, []);

  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingNavigation />
      <main>
        <HeroWrapper />
        <HowItWorksWrapper />
        <AnecdoteWrapper />
        <InTheRoomWrapper />
        <ContactWrapper />
        <FeaturesWrapper />
        <UseCasesWrapper />
        <TestimonialsWrapper />
        <CTAWrapper />
      </main>
      <MarketingFooter />
    </div>
  );
}
