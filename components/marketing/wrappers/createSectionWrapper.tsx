'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SectionWrapperOptions {
  desktop: () => Promise<{ default: ComponentType }>;
  mobile: () => Promise<{ default: ComponentType }>;
}

export function createSectionWrapper({ desktop, mobile }: SectionWrapperOptions) {
  const Desktop = dynamic(desktop, { ssr: false });
  const Mobile = dynamic(mobile, { ssr: false });

  return function SectionWrapper() {
    const isMobile = useIsMobile();
    return isMobile ? <Mobile /> : <Desktop />;
  };
}
