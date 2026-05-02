'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import { TrustStrip } from '@/components/marketing/sections/TrustStrip';
import { HeroWrapper } from '@/components/marketing/wrappers/HeroWrapper';
import { HowItWorksWrapper } from '@/components/marketing/wrappers/HowItWorksWrapper';
import { AnecdoteWrapper } from '@/components/marketing/wrappers/AnecdoteWrapper';
import { FeaturesWrapper } from '@/components/marketing/wrappers/FeaturesWrapper';
import { UseCasesWrapper } from '@/components/marketing/wrappers/UseCasesWrapper';
import { TestimonialsWrapper } from '@/components/marketing/wrappers/TestimonialsWrapper';
import { ContactWrapper } from '@/components/marketing/wrappers/ContactWrapper';
import { CTAWrapper } from '@/components/marketing/wrappers/CTAWrapper';

export function MarketingLandingPage() {
  const { theme, setTheme } = useTheme();

  // Marketing-only default: light on first visit. Once the user explicitly chooses
  // a theme via the toggle, that choice is respected (including dark).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('theme');
    if (!stored) {
      // First visit — no stored preference. Default to light.
      setTheme('light');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingNavigation />
      <main>
        <HeroWrapper />
        <TrustStrip />
        <HowItWorksWrapper />
        <AnecdoteWrapper />
        <FeaturesWrapper />
        <UseCasesWrapper />
        <TestimonialsWrapper />
        <ContactWrapper />
        <CTAWrapper />
      </main>
      <MarketingFooter />
    </div>
  );
}
