'use client';

import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import { HeroWrapper } from '@/components/marketing/wrappers/HeroWrapper';
import { HowItWorksWrapper } from '@/components/marketing/wrappers/HowItWorksWrapper';
import { AnecdoteWrapper } from '@/components/marketing/wrappers/AnecdoteWrapper';
import { FeaturesWrapper } from '@/components/marketing/wrappers/FeaturesWrapper';
import { UseCasesWrapper } from '@/components/marketing/wrappers/UseCasesWrapper';
import { TestimonialsWrapper } from '@/components/marketing/wrappers/TestimonialsWrapper';
import { ContactWrapper } from '@/components/marketing/wrappers/ContactWrapper';
import { CTAWrapper } from '@/components/marketing/wrappers/CTAWrapper';

export function MarketingLandingPage() {
  // The sketch system is light-only, but it's scoped under [data-mkt-root]
  // with hardcoded paper-palette variables — it renders correctly regardless
  // of the global theme. We deliberately do NOT call setTheme here so the
  // user's dashboard dark-mode preference is preserved.
  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingNavigation />
      <main>
        <HeroWrapper />
        <HowItWorksWrapper />
        <AnecdoteWrapper />
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
