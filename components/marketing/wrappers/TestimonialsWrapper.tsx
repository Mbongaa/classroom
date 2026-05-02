'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const TestimonialsWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Testimonials'),
  mobile: () => import('@/components/marketing/sections/Testimonials'),
});
