'use client';

import dynamic from 'next/dynamic';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  {
    ssr: false,
    loading: () => <span className="inline-block" aria-hidden="true" />,
  },
);

export default function PulsatingLoader() {
  return (
    <div className="flex items-center justify-center min-h-[100px]">
      <div className="dark:invert" style={{ width: 240, height: 180 }}>
        <DotLottieReact
          src="/lottie/typing-loader.lottie"
          autoplay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
