import { createSectionWrapper } from './createSectionWrapper';
import Hero from '@/components/marketing/sections/Hero';
import HeroMobile from '@/components/marketing/sections/Hero.mobile';

export const HeroWrapper = createSectionWrapper({
  desktop: Hero,
  mobile: HeroMobile,
});
