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
} from '@livekit/components-react';
import { Track, ConnectionQuality } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  User,
  ScreenShare,
} from 'lucide-react';
import clsx from 'clsx';
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
}

export function CustomParticipantTile({
  trackRef,
  className,
  showConnectionQuality = true,
  showSpeakingIndicator = true,
  showMetadata = true,
  aspectRatio = '1:1',
  onClick,
}: CustomParticipantTileProps) {
  const { elementProps } = useParticipantTile({
    trackRef,
    onParticipantClick: onClick ? () => onClick() : undefined,
  });

  const participant = trackRef.participant;
  const { quality } = useConnectionQualityIndicator({ participant });
  const speakingParticipants = useSpeakingParticipants();
  const isSpeaking = speakingParticipants.includes(participant);

  // Get local participant for reactive mic state
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  const isLocalParticipant = participant.identity === localParticipant?.identity;

  // Get video and audio tracks
  const videoTrack = trackRef.publication?.track;
  const isVideoEnabled = trackRef.publication?.isSubscribed &&
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
    const parts = cleanName.split(/\s+/).filter(part => part.length > 0);

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
    <VideoErrorBoundary fallbackMessage={`Error loading video for ${participant.name || participant.identity}`}>
      <div
        {...elementProps}
        className={clsx(
          'relative overflow-hidden rounded-3xl',
          'w-full h-full',
          getAspectRatioClass(), // Apply the aspect ratio class
          className
        )}
        style={{
          backgroundColor: 'var(--lk-bg3)',
          ...(isSpeaking && showSpeakingIndicator && {
            boxShadow: `0 0 0 var(--lk-speaking-thickness, 6px) var(--lk-speaking-border, white)`
          })
        }}
      >
        {/* Video/Placeholder */}
        {isVideoEnabled && videoTrack ? (
          <VideoTrack
            trackRef={trackRef}
            className="absolute inset-0 w-full h-full object-cover"
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
                      color: 'var(--lk-text1, white)'
                    }}
                  >
                    {getInitials(participant.name || participant.identity)}
                  </AvatarFallback>
                </Avatar>
              )}
              <p className="text-sm" style={{ color: 'var(--lk-text2, #6b7280)' }}>
                {isScreenShare ? 'Screen Share' : (participant.name || participant.identity)}
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
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            {/* Participant Name */}
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium truncate max-w-[150px]"
                style={{ color: 'white' }}
              >
                {participant.name || participant.identity}
              </span>
            </div>

            {/* Status Icons - removed connection quality */}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            {/* Media Status Icons */}
            <div className="flex items-center gap-2">
              {/* Microphone Status */}
              <div
                className="p-1.5 rounded-full"
                style={{
                  backgroundColor: isAudioEnabled ? 'var(--lk-bg3)' : '#ef4444'
                }}
                title={isAudioEnabled ? 'Microphone on' : 'Microphone off'}
              >
                {isAudioEnabled ? (
                  <Mic
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--lk-text1, white)' }}
                  />
                ) : (
                  <MicOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                )}
              </div>

              {/* Camera Status (only if not screen share) */}
              {!isScreenShare && (
                <div
                  className="p-1.5 rounded-full"
                  style={{
                    backgroundColor: isVideoEnabled ? 'var(--lk-bg3)' : '#ef4444'
                  }}
                  title={isVideoEnabled ? 'Camera on' : 'Camera off'}
                >
                  {isVideoEnabled ? (
                    <Video
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--lk-text1, white)' }}
                    />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5" style={{ color: 'white' }} />
                  )}
                </div>
              )}
            </div>

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
          </div>
        </div>

        {/* Additional Metadata */}
        {showMetadata && metadata.additionalInfo && (
          <div
            className="absolute top-12 left-2 right-2 text-xs rounded px-2 py-1"
            style={{
              color: 'var(--lk-text1, white)',
              backgroundColor: 'var(--lk-bg2)'
            }}
          >
            {metadata.additionalInfo}
          </div>
        )}
      </div>
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