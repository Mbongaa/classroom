'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const AnecdoteWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/Anecdote'),
  mobile: () => import('@/components/marketing/sections/Anecdote'),
});
