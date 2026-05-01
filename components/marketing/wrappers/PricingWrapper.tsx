'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const PricingWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Pricing'),
  mobile: () => import('@/components/marketing/sections/Pricing.mobile'),
});
