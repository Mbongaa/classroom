'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const FeaturesWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Features'),
  mobile: () => import('@/components/marketing/sections/Features.mobile'),
});
