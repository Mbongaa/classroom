'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const HowItWorksWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/HowItWorks'),
  mobile: () => import('@/components/marketing/sections/HowItWorks'),
});
