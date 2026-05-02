'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const ContactWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Contact'),
  mobile: () => import('@/components/marketing/sections/Contact'),
});
