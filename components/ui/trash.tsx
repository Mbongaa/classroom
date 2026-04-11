'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';

/**
 * Animated trash icon backed by a Lottie file at /lottie/trash.lottie.
 *
 * Auto-plays the Lottie animation whenever its nearest enclosing
 * `<button>` ancestor is hovered, so it can be dropped into table rows
 * and card actions without per-usage ref wiring. A forwardRef handle is
 * also exposed for call sites that need manual control.
 */

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  {
    ssr: false,
    loading: () => <span className="inline-block" aria-hidden="true" />,
  },
);

export interface TrashIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TrashIconProps {
  size?: number;
  className?: string;
}

type DotLottieInstance = {
  play: () => void;
  stop: () => void;
  pause: () => void;
};

export const TrashIcon = React.forwardRef<TrashIconHandle, TrashIconProps>(
  ({ size = 16, className }, ref) => {
    const dotLottieRef = React.useRef<DotLottieInstance | null>(null);
    const wrapperRef = React.useRef<HTMLSpanElement | null>(null);

    const play = React.useCallback(() => {
      const instance = dotLottieRef.current;
      if (!instance) return;
      instance.stop();
      instance.play();
    }, []);

    const stop = React.useCallback(() => {
      dotLottieRef.current?.stop();
    }, []);

    React.useImperativeHandle(ref, () => ({
      startAnimation: play,
      stopAnimation: stop,
    }));

    // Attach hover listeners to the nearest enclosing button so the
    // animation fires when the parent action is hovered — no ref wiring
    // required at the call site.
    React.useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;
      const parent = el.closest('button') ?? el.parentElement;
      if (!parent) return;
      parent.addEventListener('mouseenter', play);
      parent.addEventListener('mouseleave', stop);
      return () => {
        parent.removeEventListener('mouseenter', play);
        parent.removeEventListener('mouseleave', stop);
      };
    }, [play, stop]);

    return (
      <span
        ref={wrapperRef}
        className={`dark:invert${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size, display: 'inline-flex' }}
        aria-hidden="true"
      >
        <DotLottieReact
          dotLottieRefCallback={(instance: unknown) => {
            dotLottieRef.current = (instance as DotLottieInstance | null) ?? null;
          }}
          src="/lottie/trash.lottie"
          autoplay={false}
          loop={false}
          style={{ width: '100%', height: '100%' }}
        />
      </span>
    );
  },
);

TrashIcon.displayName = 'TrashIcon';
