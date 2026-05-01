'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
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
              <button
                type="button"
                className="p-1.5 rounded-full pointer-events-auto"
                style={{ backgroundColor: isStreamMuted ? '#ef4444' : 'rgba(0,0,0,0.5)' }}
                title={isStreamMuted ? 'Unmute stream' : 'Mute stream'}
                onClick={toggleStreamMute}
              >
                {isStreamMuted ? (
                  <VolumeOff className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>

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

            {/* Speaking indicator (audio visualization) */}
            {isSpeaking && (
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor: 'var(--lk-text1, white)',
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
