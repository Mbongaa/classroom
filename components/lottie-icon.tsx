'use client';

import dynamic from 'next/dynamic';

/**
 * Lightweight Lottie icon renderer. Displays a .lottie file at the given
 * size. Used by the campaign icon picker and the donate landing page.
 *
 * The dotlottie player is dynamically imported with `ssr: false` so the
 * bundle is only fetched when actually needed.
 */

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
    ),
  },
);

interface LottieIconProps {
  src: string;
  size?: number;
  loop?: boolean;
  className?: string;
  /**
   * How the animation fills the box. Defaults to 'contain' (preserve aspect
   * ratio, no clipping). Use 'cover' for source files with empty canvas
   * padding around the artwork — it scales up to fill, cropping the padding.
   */
  fit?: 'contain' | 'cover' | 'fill';
}

export function LottieIcon({ src, size, loop = true, className, fit = 'contain' }: LottieIconProps) {
  const style: React.CSSProperties = size != null
    ? { width: size, height: size }
    : { width: '100%' };

  return (
    <div
      className={className}
      style={style}
      role="presentation"
      aria-hidden="true"
    >
      <DotLottieReact
        src={src}
        autoplay
        loop={loop}
        renderConfig={{ devicePixelRatio: 2.5 }}
        layout={{ fit, align: [0.5, 0.5] }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
