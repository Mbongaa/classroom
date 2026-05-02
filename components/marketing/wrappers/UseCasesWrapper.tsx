'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const UseCasesWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/UseCases'),
  mobile: () => import('@/components/marketing/sections/UseCases'),
});
