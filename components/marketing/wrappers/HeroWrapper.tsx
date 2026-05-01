'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const HeroWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Hero'),
  mobile: () => import('@/components/marketing/sections/Hero.mobile'),
});
