'use client';

import * as React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MosqueClipFrameProps {
  /** Path to a video (.mp4/.webm) or still image (.jpg/.png/.webp/.avif). */
  videoSrc: string;
  startAt?: number;
  /** Aspect tuned per framework. "polaroid" → 4/5, "wide" → 21/9, "square" → 1/1. */
  aspect?: 'polaroid' | 'wide' | 'square' | 'natural';
  /** "spotlight" gets controls + bigger chrome; "thumb" is muted, looped, click-only. */
  variant?: 'spotlight' | 'thumb';
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Forwarded so callers can sync translation drips to currentTime.
   * For image sources, fired on a 250ms synthetic timeline so drips still play. */
  onTimeUpdate?: (currentTime: number) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  className?: string;
  style?: React.CSSProperties;
}

const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif)$/i;

/**
 * Dark video frame that lives inside the cream marketing surface.
 * Edges are pencil-bordered with a paper drop-shadow; the inside stays
 * the only dark moment on the page (PRODUCT.md "marketing surface is warm-light;
 * product preview frame stays dark").
 */
export function MosqueClipFrame({
  videoSrc,
  startAt = 0,
  aspect = 'polaroid',
  variant = 'spotlight',
  autoPlay = false,
  loop = true,
  muted = true,
  onTimeUpdate,
  videoRef,
  className = '',
  style,
}: MosqueClipFrameProps) {
  const internalRef = React.useRef<HTMLVideoElement | null>(null);
  const ref = videoRef ?? internalRef;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isImage = IMAGE_RE.test(videoSrc);
  const [isPlaying, setIsPlaying] = React.useState(autoPlay || isImage);
  const [isMuted, setIsMuted] = React.useState(muted);
  // Gate playback + preload on viewport visibility so iOS doesn't try to
  // decode 5 polaroid clips + the hero video at the same time.
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setIsInView(e.isIntersecting));
      },
      { threshold: 0.1, rootMargin: '200px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (isImage) return;
    const v = ref.current;
    if (!v) return;
    if (startAt && Math.abs(v.currentTime - startAt) > 0.5) {
      v.currentTime = startAt;
    }
  }, [startAt, ref, videoSrc, isImage]);

  // Pause when offscreen, (re)play when back in view + autoPlay was requested.
  React.useEffect(() => {
    if (isImage) return;
    const v = ref.current;
    if (!v) return;
    if (isInView) {
      if (autoPlay && v.paused) {
        v.play().catch(() => {});
      }
    } else if (!v.paused) {
      v.pause();
    }
  }, [isInView, autoPlay, isImage, ref]);

  // Synthetic timeline for image sources — drives drips at the same cadence
  // a real video would. Only spotlights need it; thumbnails are static stills.
  React.useEffect(() => {
    if (!isImage || !onTimeUpdate || variant !== 'spotlight') return;
    let t = 0;
    const TICK = 0.25;
    onTimeUpdate(0);
    const id = window.setInterval(() => {
      t += TICK;
      if (t > 60) t = 0;
      onTimeUpdate(t);
    }, 250);
    return () => window.clearInterval(id);
  }, [isImage, onTimeUpdate, variant, videoSrc]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const aspectStyle: React.CSSProperties =
    aspect === 'polaroid'
      ? { aspectRatio: '4 / 5' }
      : aspect === 'wide'
        ? { aspectRatio: '21 / 9' }
        : aspect === 'square'
          ? { aspectRatio: '1 / 1' }
          : {};

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        background: '#1a1a1a',
        border: '2px solid var(--mkt-border)',
        boxShadow: variant === 'spotlight'
          ? '8px 8px 0 0 var(--mkt-border)'
          : '4px 4px 0 0 var(--mkt-border)',
        overflow: 'hidden',
        ...aspectStyle,
        ...style,
      }}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={videoSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <video
          ref={ref}
          src={isInView ? videoSrc : undefined}
          muted={isMuted}
          loop={loop}
          autoPlay={autoPlay && isInView}
          playsInline
          preload={isInView ? 'auto' : 'none'}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Always-on chrome for the spotlight variant: a recording-dot + play/mute. */}
      {variant === 'spotlight' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px 6px 8px',
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              color: '#fdfbf7',
              fontFamily: 'var(--mkt-font-body)',
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#ff4d4d',
                animation: 'mkt-pulse 2.4s var(--mkt-ease-snap) infinite',
              }}
            />
            Live
          </div>

          {!isImage && (
            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: isPlaying ? 'transparent' : 'rgba(0,0,0,0.18)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 200ms var(--mkt-ease-snap), opacity 200ms var(--mkt-ease-snap)',
                opacity: isPlaying ? 0 : 1,
              }}
              onMouseEnter={(e) => {
                if (isPlaying) e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (isPlaying) e.currentTarget.style.opacity = '0';
              }}
            >
              <span
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 999,
                  background: 'rgba(253, 251, 247, 0.96)',
                  color: '#2d2d2d',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                }}
              >
                {isPlaying ? <Pause size={28} fill="#2d2d2d" /> : <Play size={32} fill="#2d2d2d" style={{ marginLeft: 4 }} />}
              </span>
            </button>
          )}

          {!isImage && (
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              style={{
                position: 'absolute',
                bottom: 14,
                right: 14,
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 999,
                color: '#fdfbf7',
                cursor: 'pointer',
              }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
        </>
      )}

      {variant === 'thumb' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
