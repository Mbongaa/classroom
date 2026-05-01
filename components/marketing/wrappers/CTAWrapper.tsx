'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const CTAWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/CTA'),
  mobile: () => import('@/components/marketing/sections/CTA.mobile'),
});
