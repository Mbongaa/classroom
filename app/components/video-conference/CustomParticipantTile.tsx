'use client';

import React from 'react';
import {
  useParticipantTile,
  VideoTrack,
  AudioTrack,
  TrackReference,
  isTrackReference,
  useConnectionQualityIndicator,
  useSpeakingParticipants,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import { Track, ConnectionQuality, TranscriptionSegment, RoomEvent } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, Wifi, WifiOff, User, ScreenShare, Maximize2, Minimize2, Minus, Plus, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoErrorBoundary } from './VideoErrorBoundary';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface CustomParticipantTileProps {
  trackRef: TrackReference;
  className?: string;
  showConnectionQuality?: boolean;
  showSpeakingIndicator?: boolean;
  showMetadata?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  onClick?: () => void;
  fullscreenOverlay?: React.ReactNode;
}

export function CustomParticipantTile({
  trackRef,
  className,
  showConnectionQuality = true,
  showSpeakingIndicator = true,
  showMetadata = true,
  aspectRatio = '1:1',
  onClick,
  fullscreenOverlay,
}: CustomParticipantTileProps) {
  const { elementProps } = useParticipantTile({
    trackRef,
    onParticipantClick: onClick ? () => onClick() : undefined,
    htmlProps: {},
  });

  const participant = trackRef.participant;
  const { quality } = useConnectionQualityIndicator({ participant });
  const speakingParticipants = useSpeakingParticipants();
  const isSpeaking = speakingParticipants.includes(participant);

  // Get local participant for reactive mic state
  const { localParticipant, microphoneTrack, cameraTrack } = useLocalParticipant();
  const isLocalParticipant = participant.identity === localParticipant?.identity;
  const room = useRoomContext();

  // Fullscreen state + ref
  const tileRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === tileRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Escape key exits CSS fallback fullscreen (browser API handles its own Escape)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // On mobile, treat as fullscreen mode by default (overlay + top controls)
  const isMobile = useIsMobile();
  const isFullscreenMode = isFullscreen || isMobile;

  // CSS-based fullscreen fallback: isFullscreen is true but browser API isn't active
  const isCssFallbackFullscreen = isFullscreen && document.fullscreenElement !== tileRef.current;

  // Fullscreen translation captions — only listen when in fullscreen
  const [fullscreenCaptions, setFullscreenCaptions] = React.useState<TranscriptionSegment[]>([]);
  const captionsLanguage = localParticipant?.attributes?.captions_language || 'en';

  // Translation service status: tracks whether segments are actively arriving
  const [translationStatus, setTranslationStatus] = React.useState<'connecting' | 'active' | 'warning'>('connecting');
  const healthTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!isFullscreenMode || !room) return;

    // Start as connecting
    setTranslationStatus('connecting');

    // Timeout to warning if nothing arrives
    healthTimeoutRef.current = setTimeout(() => setTranslationStatus('warning'), 15000);

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      const filtered = segments.filter((seg) => seg.language === captionsLanguage);
      if (filtered.length === 0) return;

      // Mark active and reset timeout
      setTranslationStatus('active');
      if (healthTimeoutRef.current) clearTimeout(healthTimeoutRef.current);
      healthTimeoutRef.current = setTimeout(() => setTranslationStatus('warning'), 15000);

      setFullscreenCaptions((prev) => {
        const updated = { ...Object.fromEntries(prev.map((s) => [s.id, s])) };
        for (const seg of filtered) {
          updated[seg.id] = seg;
        }
        // Keep last 20 segments to fill the overlay
        return Object.values(updated)
          .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
          .slice(-20);
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      if (healthTimeoutRef.current) clearTimeout(healthTimeoutRef.current);
      setFullscreenCaptions([]);
    };
  }, [isFullscreenMode, room, captionsLanguage]);

  // Fullscreen overlay font size — smaller default on mobile
  const [overlayFontSize, setOverlayFontSize] = React.useState(() => isMobile ? 18 : 32);
  const OVERLAY_MIN_FONT = 12;
  const OVERLAY_MAX_FONT = 48;
  const OVERLAY_FONT_STEP = 2;

  // Auto-scroll for fullscreen captions (same pattern as SpeechTranslationPanel)
  const overlayScrollRef = React.useRef<HTMLDivElement>(null);
  const overlayUserScrollingRef = React.useRef(false);
  const overlayAutoScrollRef = React.useRef(true);
  const [showOverlayScrollBtn, setShowOverlayScrollBtn] = React.useState(false);

  React.useEffect(() => {
    const el = overlayScrollRef.current;
    if (!el || !isFullscreenMode) return;

    const onInteractionStart = () => { overlayUserScrollingRef.current = true; };
    const onInteractionEnd = () => {
      setTimeout(() => { overlayUserScrollingRef.current = false; }, 150);
    };
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

      // User scrolled up — disable auto-scroll
      if (overlayUserScrollingRef.current && distFromBottom > 150) {
        overlayAutoScrollRef.current = false;
        setShowOverlayScrollBtn(true);
      }

      // User scrolled back to bottom — re-enable
      if (distFromBottom < 50) {
        overlayAutoScrollRef.current = true;
        setShowOverlayScrollBtn(false);
      }
    };

    // Wheel immediately disables auto-scroll when scrolling up
    const onWheel = (e: WheelEvent) => {
      overlayUserScrollingRef.current = true;
      if (e.deltaY < 0) {
        overlayAutoScrollRef.current = false;
        setShowOverlayScrollBtn(true);
      }
    };

    el.addEventListener('touchstart', onInteractionStart, { passive: true });
    el.addEventListener('touchend', onInteractionEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('pointerup', onInteractionEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onInteractionStart);
      el.removeEventListener('touchend', onInteractionEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerup', onInteractionEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, [isFullscreenMode]);

  // Auto-scroll on new captions — only if user hasn't scrolled up
  React.useLayoutEffect(() => {
    if (overlayScrollRef.current && fullscreenCaptions.length > 0 && overlayAutoScrollRef.current) {
      overlayScrollRef.current.scrollTop = overlayScrollRef.current.scrollHeight;
    }
  }, [fullscreenCaptions]);

  const toggleFullscreen = React.useCallback(() => {
    if (!tileRef.current) return;
    if (document.fullscreenElement === tileRef.current) {
      document.exitFullscreen().catch(() => {
        setIsFullscreen(false);
      });
    } else {
      tileRef.current.requestFullscreen().catch(() => {
        // Fullscreen API failed (permissions policy, iframe, browser restriction).
        // Fall back to CSS-based fullscreen so the overlay still works.
        setIsFullscreen((prev) => !prev);
      });
    }
  }, []);

  const toggleMic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocalParticipant) {
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
    }
  };

  const toggleCamera = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocalParticipant) {
      await room.localParticipant.setCameraEnabled(!isVideoEnabled);
    }
  };

  // Get video and audio tracks
  const videoTrack = trackRef.publication?.track;
  const isVideoEnabled =
    trackRef.publication?.isSubscribed &&
    (trackRef.source === Track.Source.Camera || trackRef.source === Track.Source.ScreenShare) &&
    !trackRef.publication?.isMuted;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  // Check audio status - use reactive state for local participant
  const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
  const isAudioEnabled = isLocalParticipant
    ? microphoneTrack?.track && !microphoneTrack.track.isMuted
    : audioPublication?.track && !audioPublication?.isMuted;

  // Parse metadata if available
  const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  const role = metadata.role || 'participant';

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '4:3':
        return 'aspect-[4/3]';
      case '1:1':
        return 'aspect-square';
      default:
        return 'aspect-video';
    }
  };

  const getConnectionQualityColor = (quality: ConnectionQuality) => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 'text-green-500';
      case ConnectionQuality.Good:
        return 'text-yellow-500';
      case ConnectionQuality.Poor:
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'teacher':
        return '👨‍🏫';
      case 'student_speaker':
        return '🎤';
      case 'student':
        return '👨‍🎓';
      default:
        return null;
    }
  };

  // Extract initials from participant name
  const getInitials = (name: string | undefined) => {
    if (!name || name.trim() === '') {
      return 'UN'; // Unknown
    }

    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/).filter((part) => part.length > 0);

    if (parts.length === 0) {
      return 'UN';
    }

    if (parts.length === 1) {
      // For single word names, take first two letters
      return parts[0].slice(0, 2).toUpperCase();
    }

    // For multiple word names, take first letter of first and last word
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <VideoErrorBoundary
      fallbackMessage={`Error loading video for ${participant.name || participant.identity}`}
    >
      <div
        {...elementProps}
        ref={tileRef}
        className={clsx(
          'relative overflow-hidden group',
          'w-full h-full',
          isFullscreenMode ? 'rounded-none bg-black' : 'rounded-3xl',
          getAspectRatioClass(),
          className,
        )}
        style={{
          backgroundColor: 'var(--lk-bg3)',
          ...(isSpeaking &&
            showSpeakingIndicator && {
              boxShadow: `0 0 0 var(--lk-speaking-thickness, 6px) var(--lk-speaking-border, white)`,
            }),
          ...(isCssFallbackFullscreen && {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            width: '100vw',
            height: '100vh',
          }),
        }}
      >
        {/* Video/Placeholder */}
        {isVideoEnabled && videoTrack ? (
          <VideoTrack
            trackRef={trackRef}
            className={clsx("absolute inset-0 w-full h-full", isFullscreenMode ? "object-contain" : "object-cover")}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="text-center">
              {isScreenShare ? (
                <ScreenShare
                  className="w-16 h-16 mx-auto mb-2"
                  style={{ color: 'var(--lk-text2, #6b7280)' }}
                />
              ) : (
                <Avatar
                  className="w-20 h-20 mx-auto mb-2 border-2"
                  style={{ borderColor: 'var(--lk-bg4)' }}
                >
                  <AvatarFallback
                    className="text-2xl font-semibold"
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--lk-text1, white)',
                    }}
                  >
                    {getInitials(participant.name || participant.identity)}
                  </AvatarFallback>
                </Avatar>
              )}
              <p className="text-sm" style={{ color: 'var(--lk-text2, #6b7280)' }}>
                {isScreenShare ? 'Screen Share' : participant.name || participant.identity}
              </p>
            </div>
          </div>
        )}

        {/* Audio Track (invisible but necessary for audio playback) */}
        {audioPublication && audioPublication.track && (
          <AudioTrack
            trackRef={{
              participant,
              source: Track.Source.Microphone,
              publication: audioPublication,
            }}
          />
        )}

        {/* Overlay Information */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar — in fullscreen all controls merge into one row */}
          <div className="absolute top-0 left-0 right-0 p-2">
            <div className="flex items-center justify-between">
              {/* Left: Status dot (fullscreen) + Name + media icons */}
              <div className="flex items-center gap-2">
                {isFullscreenMode && (
                  <span
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      translationStatus === 'active' && "bg-red-500 animate-pulse",
                      translationStatus === 'connecting' && "bg-yellow-500 animate-pulse",
                      translationStatus === 'warning' && "bg-gray-500",
                    )}
                    title={translationStatus === 'active' ? 'Live' : translationStatus === 'connecting' ? 'Connecting...' : 'No signal'}
                  />
                )}
                <span
                  className="text-sm font-medium truncate max-w-[150px] text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {participant.name || participant.identity}
                </span>

                {isFullscreenMode && (
                  <>
                    {/* Microphone Status */}
                    <button
                      className="p-1.5 rounded-full pointer-events-auto"
                      style={{
                        backgroundColor: isAudioEnabled ? 'var(--lk-bg3)' : '#ef4444',
                        cursor: isLocalParticipant ? 'pointer' : 'default',
                      }}
                      title={isLocalParticipant
                        ? (isAudioEnabled ? 'Click to mute' : 'Click to unmute')
                        : (isAudioEnabled ? 'Microphone on' : 'Microphone off')}
                      onClick={isLocalParticipant ? toggleMic : undefined}
                    >
                      {isAudioEnabled ? (
                        <Mic className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                      ) : (
                        <MicOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                      )}
                    </button>

                    {/* Camera Status */}
                    {!isScreenShare && (
                      <button
                        className="p-1.5 rounded-full pointer-events-auto"
                        style={{
                          backgroundColor: isVideoEnabled ? 'var(--lk-bg3)' : '#ef4444',
                          cursor: isLocalParticipant ? 'pointer' : 'default',
                        }}
                        title={isLocalParticipant
                          ? (isVideoEnabled ? 'Click to turn off camera' : 'Click to turn on camera')
                          : (isVideoEnabled ? 'Camera on' : 'Camera off')}
                        onClick={isLocalParticipant ? toggleCamera : undefined}
                      >
                        {isVideoEnabled ? (
                          <Video className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                        ) : (
                          <VideoOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                        )}
                      </button>
                    )}

                    {/* Speaking Indicator */}
                    {showSpeakingIndicator && isSpeaking && (
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
                  </>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                className="p-1.5 rounded-full pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Bottom Bar — only in non-fullscreen mode (in fullscreen/mobile, controls are in top bar) */}
          {!isFullscreenMode && (
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  className="p-1.5 rounded-full pointer-events-auto"
                  style={{
                    backgroundColor: isAudioEnabled ? 'var(--lk-bg3)' : '#ef4444',
                    cursor: isLocalParticipant ? 'pointer' : 'default',
                  }}
                  title={isLocalParticipant
                    ? (isAudioEnabled ? 'Click to mute' : 'Click to unmute')
                    : (isAudioEnabled ? 'Microphone on' : 'Microphone off')}
                  onClick={isLocalParticipant ? toggleMic : undefined}
                >
                  {isAudioEnabled ? (
                    <Mic className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                  ) : (
                    <MicOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                  )}
                </button>

                {!isScreenShare && (
                  <button
                    className="p-1.5 rounded-full pointer-events-auto"
                    style={{
                      backgroundColor: isVideoEnabled ? 'var(--lk-bg3)' : '#ef4444',
                      cursor: isLocalParticipant ? 'pointer' : 'default',
                    }}
                    title={isLocalParticipant
                      ? (isVideoEnabled ? 'Click to turn off camera' : 'Click to turn on camera')
                      : (isVideoEnabled ? 'Camera on' : 'Camera off')}
                    onClick={isLocalParticipant ? toggleCamera : undefined}
                  >
                    {isVideoEnabled ? (
                      <Video className="w-3.5 h-3.5" style={{ color: 'var(--lk-text1, white)' }} />
                    ) : (
                      <VideoOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                    )}
                  </button>
                )}
              </div>

              {showSpeakingIndicator && isSpeaking && (
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
          )}

          {/* Additional Metadata */}
          {showMetadata && metadata.additionalInfo && (
            <div
              className="absolute top-12 left-2 right-2 text-xs rounded px-2 py-1"
              style={{
                color: 'var(--lk-text1, white)',
                backgroundColor: 'var(--lk-bg2)',
              }}
            >
              {metadata.additionalInfo}
            </div>
          )}
        </div>

        {/* Fullscreen/Mobile Translation Overlay - bottom 33% */}
        {isFullscreenMode && (
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-auto"
            style={{ height: '33%', zIndex: 10 }}
          >
            {/* Black gradient background within the 33% overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.7) 100%)',
              }}
            />
            {/* Text content */}
            <div className="relative h-full flex flex-col justify-end p-6">
              {fullscreenOverlay || (
                fullscreenCaptions.length > 0 && (
                  <>
                    <div
                      ref={overlayScrollRef}
                      className="h-full overflow-y-auto space-y-2 scrollbar-none"
                      style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, white 70%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, white 70%)',
                        scrollbarWidth: 'none',
                      } as React.CSSProperties}
                    >
                      {/* Spacer pushes content to bottom while allowing scroll up */}
                      <div className="flex-shrink-0" style={{ minHeight: '100%' }} />
                      {fullscreenCaptions.map((seg, i) => (
                        <p
                          key={seg.id}
                          className="text-center text-white font-medium leading-relaxed"
                          style={{
                            fontSize: `${i === fullscreenCaptions.length - 1 ? overlayFontSize : overlayFontSize * 0.75}px`,
                            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                          }}
                        >
                          {seg.text}
                        </p>
                      ))}
                    </div>

                    {/* Scroll to latest button */}
                    {showOverlayScrollBtn && (
                      <button
                        className="absolute bottom-14 left-1/2 -translate-x-1/2 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                        onClick={() => {
                          if (overlayScrollRef.current) {
                            overlayScrollRef.current.scrollTop = overlayScrollRef.current.scrollHeight;
                            overlayAutoScrollRef.current = true;
                            setShowOverlayScrollBtn(false);
                          }
                        }}
                        title="Scroll to latest"
                      >
                        <ArrowDown className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </>
                )
              )}

              {/* Font size controls — bottom left */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1">
                <button
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => setOverlayFontSize((prev) => Math.max(OVERLAY_MIN_FONT, prev - OVERLAY_FONT_STEP))}
                  disabled={overlayFontSize <= OVERLAY_MIN_FONT}
                  title="Decrease font size"
                >
                  <Minus className="w-3.5 h-3.5 text-white" />
                </button>
                <span className="text-xs text-white/70 min-w-[2ch] text-center">{overlayFontSize}</span>
                <button
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => setOverlayFontSize((prev) => Math.min(OVERLAY_MAX_FONT, prev + OVERLAY_FONT_STEP))}
                  disabled={overlayFontSize >= OVERLAY_MAX_FONT}
                  title="Increase font size"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VideoErrorBoundary>
  );
}

// Memoize component for performance optimization
export default React.memo(CustomParticipantTile, (prevProps, nextProps) => {
  // Only re-render if essential props change
  return (
    prevProps.trackRef.participant.identity === nextProps.trackRef.participant.identity &&
    prevProps.trackRef.publication?.trackSid === nextProps.trackRef.publication?.trackSid &&
    prevProps.showSpeakingIndicator === nextProps.showSpeakingIndicator &&
    prevProps.showConnectionQuality === nextProps.showConnectionQuality &&
    prevProps.className === nextProps.className &&
    prevProps.aspectRatio === nextProps.aspectRatio
  );
});
