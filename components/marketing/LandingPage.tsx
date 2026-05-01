'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import { TrustStrip } from '@/components/marketing/sections/TrustStrip';
import { HeroWrapper } from '@/components/marketing/wrappers/HeroWrapper';
import { HowItWorksWrapper } from '@/components/marketing/wrappers/HowItWorksWrapper';
import { FeaturesWrapper } from '@/components/marketing/wrappers/FeaturesWrapper';
import { UseCasesWrapper } from '@/components/marketing/wrappers/UseCasesWrapper';
import { PricingWrapper } from '@/components/marketing/wrappers/PricingWrapper';
import { CTAWrapper } from '@/components/marketing/wrappers/CTAWrapper';

export function MarketingLandingPage() {
  const { theme, setTheme } = useTheme();

  // Marketing-only default: light. Other routes keep next-themes' defaultTheme="dark".
  // Once the user toggles, we respect that choice (it's persisted in localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('theme');
    if (!stored || stored === 'dark') {
      // No stored preference (first visit) OR app-level dark default carried over
      // from another route — flip to light for the marketing surface.
      setTheme('light');
    }
    // We intentionally only run this on mount. If the user toggles while on this
    // page, the toggle owns the choice from there forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingNavigation />
      <main>
        <HeroWrapper />
        <TrustStrip />
        <HowItWorksWrapper />
        <FeaturesWrapper />
        <UseCasesWrapper />
        <PricingWrapper />
        <CTAWrapper />
      </main>
      <MarketingFooter />
    </div>
  );
}
