'use client';

import { createSectionWrapper } from './createSectionWrapper';

export const InTheRoomWrapper = createSectionWrapper({
  desktop: () => import('@/components/marketing/sections/in-the-room/PolaroidWall'),
  mobile: () => import('@/components/marketing/sections/in-the-room/PolaroidWall'),
});
