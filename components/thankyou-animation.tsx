'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { CANCELLED_ANIMATION, getThankYouAnimation } from '@/lib/thankyou-animations';

/**
 * Thank-you / cancelled animation player.
 *
 * Renders a dotLottie animation. Used by:
 *   - /donate/[mosque]/thank-you            (mosque-scoped, picks from catalog)
 *   - /thank-you                            (generic fallback, uses default)
 *   - /mosque-admin/[slug]/settings tab     (preview tiles in the picker)
 *
 * The dotlottie player is dynamically imported with `ssr: false` so the
 * ~100KB player bundle is only fetched on routes that actually render an
 * animation. The thank-you page works without it because Next.js streams
 * the rest of the page first.
 */

// next/dynamic with ssr: false avoids hydration mismatches and only ships
// the player to the browser when it's actually needed.
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false, loading: () => <AnimationSkeleton /> },
);

interface ThankYouAnimationPlayerProps {
  /** 'paid' uses the catalog (per-mosque), 'cancelled' uses the fixed asset. */
  kind: 'paid' | 'cancelled';
  /** Mosque's selected animation id from `mosques.thankyou_animation_id`. Ignored when kind=cancelled. */
  animationId?: string | null;
  /** Whether to loop. Default: false (plays once for thank-you, true for picker previews). */
  loop?: boolean;
  /** Width/height in pixels for the square render box. */
  size?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

export function ThankYouAnimationPlayer({
  kind,
  animationId,
  loop = false,
  size = 200,
  className,
}: ThankYouAnimationPlayerProps) {
  const file = kind === 'cancelled' ? CANCELLED_ANIMATION.file : getThankYouAnimation(animationId).file;

  // Delay mounting the player by 1s so the page has time to paint before the
  // animation begins — otherwise it starts mid-load and the user misses it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="presentation"
      aria-hidden="true"
    >
      {ready ? (
        <DotLottieReact src={file} autoplay loop={loop} style={{ width: '100%', height: '100%' }} />
      ) : (
        <AnimationSkeleton />
      )}
    </div>
  );
}

/** Lightweight loading placeholder so the layout doesn't shift. */
function AnimationSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-full w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
    />
  );
}
