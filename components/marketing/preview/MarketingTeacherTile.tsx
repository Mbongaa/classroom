'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeOff,
} from 'lucide-react';

interface MarketingTeacherTileProps {
  videoSrc: string;
  name: string;
  className?: string;
  onTimeUpdate?: (time: number) => void;
}

/**
 * Marketing-mode replica of CustomParticipantTile.
 *
 * Renders the SAME JSX shape, classes, and inline-style structure as
 * `app/components/video-conference/CustomParticipantTile.tsx`, but with
 * stubbed static values where that component would call LiveKit hooks.
 * Drives playback from a local mp4 instead of a live track.
 */
export function MarketingTeacherTile({
  videoSrc,
  name,
  className = '',
  onTimeUpdate,
}: MarketingTeacherTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreamMuted, setIsStreamMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Static stand-ins for the hooks
  const isVideoEnabled = true;
  const isAudioEnabled = true;
  const isFullscreenMode = false;
  const isFullscreen = false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      onTimeUpdate?.(video.currentTime);
      setIsSpeaking(!video.paused);
    };
    const handleEnd = () => onTimeUpdate?.(0);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnd);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnd);
    };
  }, [onTimeUpdate]);

  const toggleStreamMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isStreamMuted;
    setIsStreamMuted(!isStreamMuted);
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden group',
        'w-full h-full',
        isFullscreenMode ? 'rounded-none bg-black' : 'rounded-3xl',
        className,
      )}
      style={{
        backgroundColor: 'var(--lk-bg3)',
        ...(isSpeaking && {
          boxShadow: '0 0 0 var(--lk-speaking-thickness, 6px) var(--lk-speaking-border, white)',
        }),
      }}
    >
      {/* Video element — mirrors VideoTrack */}
      {isVideoEnabled ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted={isStreamMuted}
          playsInline
          preload="auto"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : null}

      {/* Hand-drawn cue arrow pointing at the unmute button. Only visible
          while muted; slithers in 1s after mount with a stroke-draw animation,
          then the arrowhead fades in. */}
      {isStreamMuted && <UnmuteCueArrow />}

      {/* Overlay layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium truncate max-w-[150px] text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                {name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Stream mute toggle */}
              {isStreamMuted ? (
                <div
                  className="relative pointer-events-auto"
                  style={{ display: 'inline-flex' }}
                >
                  {[0, 1].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      initial={{ scale: 1, opacity: 0 }}
                      animate={{ scale: 2.4, opacity: [0.55, 0] }}
                      transition={{
                        duration: 2,
                        delay: i * 1,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 9999,
                        backgroundColor: '#ef4444',
                        pointerEvents: 'none',
                        transformOrigin: 'center',
                        willChange: 'transform, opacity',
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="relative p-1.5 rounded-full"
                    title="Tap to hear the audio"
                    aria-label="Unmute audio"
                    onClick={toggleStreamMute}
                    style={{
                      backgroundColor: '#ef4444',
                      border: 'none',
                      cursor: 'pointer',
                      zIndex: 1,
                    }}
                  >
                    <VolumeOff className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="p-1.5 rounded-full pointer-events-auto"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  title="Mute stream"
                  onClick={toggleStreamMute}
                >
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}

              {/* Fullscreen toggle (presentation only — appears on hover) */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="p-1.5 rounded-full pointer-events-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mic */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="p-1.5 rounded-full pointer-events-auto"
                style={{
                  backgroundColor: isAudioEnabled ? 'var(--lk-bg3)' : '#ef4444',
                  cursor: 'default',
                }}
                title={isAudioEnabled ? 'Microphone on' : 'Microphone off'}
              >
                {isAudioEnabled ? (
                  <Mic className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                ) : (
                  <MicOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                )}
              </button>

              {/* Camera */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="p-1.5 rounded-full pointer-events-auto"
                style={{
                  backgroundColor: isVideoEnabled ? 'var(--lk-bg3)' : '#ef4444',
                  cursor: 'default',
                }}
                title={isVideoEnabled ? 'Camera on' : 'Camera off'}
              >
                {isVideoEnabled ? (
                  <Video className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                ) : (
                  <VideoOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                )}
              </button>
            </div>

            {/* Speaking indicator (audio visualization). Inside the marketing
                surface --mkt-border is defined and takes precedence so the
                bars match the translation-card pencil border. Outside it
                (production view) the fallback chain keeps the existing
                --lk-text1 → white behavior intact. */}
            {isSpeaking && (
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: 'var(--mkt-border, var(--lk-text1, white))',
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hand-drawn curved arrow that slithers DOWN from above the viewport top
 * (off-screen, above the marketing header), through the header, and ends
 * pointing DOWN at the unmute button in the top-right of the tile.
 *
 * Uses `position: fixed` with a negative `top` so the path origin sits
 * genuinely above the viewport edge. Mobile-only — on desktop the layout
 * + larger viewport make this cue unnecessary and the geometry would not
 * align cleanly.
 *
 * `pathLength="1"` normalizes the path so stroke-dashoffset animates
 * proportionally regardless of actual path length.
 */
function UnmuteCueArrow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none md:hidden"
      style={{
        position: 'fixed',
        top: -56,
        right: 0,
        width: 200,
        height: 250,
        zIndex: 50,
      }}
    >
      <svg
        width="200"
        height="250"
        viewBox="0 0 200 250"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        {/* Slithering line: starts off-screen above the header (SVG y < 56
            is above viewport because container top:-56), travels in two
            S-curves through the header and into the hero, ends just above
            the unmute button. The button center on a 390-wide mobile
            viewport sits at roughly viewport (356, 104), which maps to SVG
            (166, 160). The line ends 16px above that so the arrowhead
            doesn't overlap the button artwork. */}
        <path
          d="M 130 0 Q 20 50, 70 110 Q 130 170, 166 144"
          stroke="var(--mkt-border, #2d2d2d)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          pathLength="1"
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 1,
            animation:
              'mkt-arrow-draw 1400ms cubic-bezier(0.22, 1, 0.36, 1) 1s forwards',
          }}
        />
        {/* Arrowhead — V-shape opening upward so the arrow visually points
            DOWN at the button. Fades in after the slithering line lands. */}
        <path
          d="M 166 144 L 158 134 M 166 144 L 174 134"
          stroke="var(--mkt-border, #2d2d2d)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{
            opacity: 0,
            animation: 'mkt-arrowhead-show 220ms ease-out 2.35s forwards',
          }}
        />
      </svg>
    </div>
  );
}
