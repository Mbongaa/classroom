import { MarketingNavigation } from '@/components/marketing/shared/MarketingNavigation';
import { MarketingFooter } from '@/components/marketing/shared/MarketingFooter';
import { MarketingActiveClass } from '@/components/marketing/shared/MarketingActiveClass';
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
  return (
    <div data-mkt-root className="min-h-screen">
      <MarketingActiveClass />
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
