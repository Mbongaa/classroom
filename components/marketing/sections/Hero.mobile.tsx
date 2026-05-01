'use client';

import { MarketingStudentView } from '@/components/marketing/preview/MarketingStudentView';

export default function HeroMobile() {
  return (
    <section
      aria-label="Bayaan student view"
      className="relative"
      style={{
        height: 'calc(100svh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#000',
      }}
    >
      <MarketingStudentView variant="mobile" fillParent />
    </section>
  );
}
