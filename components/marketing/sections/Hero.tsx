'use client';

import { MarketingStudentView } from '@/components/marketing/preview/MarketingStudentView';

export default function Hero() {
  return (
    <section
      aria-label="Bayaan student view"
      className="relative"
      style={{
        // Sits directly below the 64px sticky nav. Together they fill exactly one viewport.
        height: 'calc(100svh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        // Transparent — the paper texture from [data-mkt-root] shows through.
        background: 'transparent',
      }}
    >
      <MarketingStudentView variant="desktop" fillParent />
    </section>
  );
}
