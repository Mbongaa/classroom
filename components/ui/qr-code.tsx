'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';

/**
 * Animated QR-code icon backed by a Lottie file at /lottie/qr-code.json.
 *
 * Mirrors the Handle API used by the lucide-animated shadcn icons
 * (`CopyIconHandle`, `DownloadIconHandle`) so parent buttons can trigger
 * the animation on hover/click via a ref.
 */

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  {
    ssr: false,
    loading: () => <span className="inline-block" aria-hidden="true" />,
  },
);

export interface QrCodeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface QrCodeIconProps {
  size?: number;
  className?: string;
}

export const QrCodeIcon = React.forwardRef<QrCodeIconHandle, QrCodeIconProps>(
  ({ size = 16, className }, ref) => {
    // The DotLottie player exposes play/stop/pause on its instance. We grab
    // that via the ref callback and re-expose a minimal handle upward.
    type DotLottieInstance = {
      play: () => void;
      stop: () => void;
      pause: () => void;
    };
    const dotLottieRef = React.useRef<DotLottieInstance | null>(null);

    React.useImperativeHandle(ref, () => ({
      startAnimation: () => {
        const instance = dotLottieRef.current;
        if (!instance) return;
        instance.stop();
        instance.play();
      },
      stopAnimation: () => {
        dotLottieRef.current?.stop();
      },
    }));

    return (
      <span
        className={className}
        style={{ width: size, height: size, display: 'inline-flex' }}
        aria-hidden="true"
      >
        <DotLottieReact
          dotLottieRefCallback={(instance: unknown) => {
            dotLottieRef.current = (instance as DotLottieInstance | null) ?? null;
          }}
          src="/lottie/qr-code.json"
          autoplay={false}
          loop={false}
          style={{ width: '100%', height: '100%' }}
        />
      </span>
    );
  },
);

QrCodeIcon.displayName = 'QrCodeIcon';
