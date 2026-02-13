'use client';

import React from 'react';
import { Track, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import PreJoinLanguageSelect from '../PreJoinLanguageSelect';
import { Button } from '@/components/ui/moving-border';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Mic, MicOff, Camera, CameraOff, ChevronDown } from 'lucide-react';

interface CustomPreJoinProps {
  onSubmit: (values: {
    username: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
    videoDeviceId: string;
    audioDeviceId: string;
  }) => void;
  onError?: (error: Error) => void;
  defaults?: {
    username?: string;
    videoEnabled?: boolean;
    audioEnabled?: boolean;
  };
  showLanguageSelector?: boolean;
  selectedLanguage?: string;
  onLanguageChange?: (language: string) => void;
  selectedTranslationLanguage?: string;
  onTranslationLanguageChange?: (language: string) => void;
  isTeacher?: boolean;
  isStudent?: boolean;
  isSpeechListener?: boolean;
}

export default function CustomPreJoin({
  onSubmit,
  onError,
  defaults,
  showLanguageSelector = false,
  selectedLanguage = '',
  onLanguageChange,
  selectedTranslationLanguage = '',
  onTranslationLanguageChange,
  isTeacher = false,
  isStudent = false,
  isSpeechListener = false,
}: CustomPreJoinProps) {
  // State management
  const [username, setUsername] = React.useState(defaults?.username || '');
  // Force disable media for students and speech listeners
  const shouldDisableMedia = isStudent || isSpeechListener;
  const [videoEnabled, setVideoEnabled] = React.useState(
    shouldDisableMedia ? false : defaults?.videoEnabled !== undefined ? defaults.videoEnabled : true,
  );
  const [audioEnabled, setAudioEnabled] = React.useState(
    shouldDisableMedia ? false : defaults?.audioEnabled !== undefined ? defaults.audioEnabled : true,
  );
  const [videoDeviceId, setVideoDeviceId] = React.useState<string>('');
  const [audioDeviceId, setAudioDeviceId] = React.useState<string>('');

  // Sync username with defaults when it changes (e.g., when room metadata loads)
  React.useEffect(() => {
    if (defaults?.username) {
      setUsername(defaults.username);
    }
  }, [defaults?.username]);

  // Media tracks
  const [localVideoTrack, setLocalVideoTrack] = React.useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = React.useState<any>(null);
  const videoEl = React.useRef<HTMLVideoElement>(null);

  // Device lists
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);

  // Determine if media controls should be hidden (for students and speech listeners)
  const shouldHideMedia = isStudent || isSpeechListener;

  // Get media devices
  React.useEffect(() => {
    // Skip all media device setup for students and speech listeners
    if (shouldHideMedia) return;

    const getDevices = async () => {
      // Request video and audio permissions separately to handle missing camera gracefully
      let hasVideoPermission = false;
      let hasAudioPermission = false;

      // Try video permission first (may fail if no camera)
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        hasVideoPermission = true;
      } catch (error) {
        console.log('No camera available or permission denied, audio-only mode');
      }

      // Try audio permission (should work even if video failed)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        hasAudioPermission = true;
      } catch (error) {
        console.error('Failed to get audio permission:', error);
      }

      // Only proceed if at least audio is available
      if (!hasAudioPermission && !hasVideoPermission) {
        console.error('No media devices available');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        const audioInputs = devices.filter((device) => device.kind === 'audioinput');

        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);

        // Set default video device OR auto-disable video if no camera found
        if (videoInputs.length > 0 && !videoDeviceId) {
          setVideoDeviceId(videoInputs[0].deviceId);
        } else if (videoInputs.length === 0) {
          // No camera found - automatically disable video
          setVideoEnabled(false);
        }

        // Set default audio device
        if (audioInputs.length > 0 && !audioDeviceId) {
          setAudioDeviceId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    };

    getDevices();
  }, [shouldHideMedia, audioDeviceId, videoDeviceId]);

  // Initialize video track
  React.useEffect(() => {
    // Skip video track initialization for students and speech listeners
    if (shouldHideMedia) return;

    let track: any = null;

    const initVideoTrack = async () => {
      // Only try to create video track if we have devices AND video is enabled
      if (videoEnabled && videoDeviceId && videoDevices.length > 0) {
        try {
          track = await createLocalVideoTrack({
            deviceId: videoDeviceId,
            resolution: { width: 1280, height: 720 },
          });
          setLocalVideoTrack(track);
          if (videoEl.current) {
            track.attach(videoEl.current);
          }
        } catch (error) {
          console.error('Failed to create video track:', error);
          setVideoEnabled(false);
        }
      } else {
        // When disabled or no devices, clear the state
        setLocalVideoTrack(null);
      }
    };

    initVideoTrack();

    return () => {
      if (track) {
        track.stop();
      }
    };
  }, [videoEnabled, videoDeviceId, videoDevices.length, shouldHideMedia]);

  // Initialize audio track
  React.useEffect(() => {
    // Skip audio track initialization for students and speech listeners
    if (shouldHideMedia) return;

    let track: any = null;

    const initAudioTrack = async () => {
      if (audioEnabled && audioDeviceId) {
        try {
          track = await createLocalAudioTrack({
            deviceId: audioDeviceId,
          });
          setLocalAudioTrack(track);
        } catch (error) {
          console.error('Failed to create audio track:', error);
          setAudioEnabled(false);
        }
      } else {
        // When disabled, clear the state
        setLocalAudioTrack(null);
      }
    };

    initAudioTrack();

    return () => {
      if (track) {
        track.stop();
      }
    };
  }, [audioEnabled, audioDeviceId, shouldHideMedia]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      onError?.(new Error('Please enter your name'));
      return;
    }

    // Clean up tracks before submitting
    if (localVideoTrack) {
      localVideoTrack.stop();
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
    }

    onSubmit({
      username: username.trim(),
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
    });
  };

  const toggleVideo = () => {
    setVideoEnabled((prev) => !prev);
  };

  const toggleAudio = () => {
    setAudioEnabled((prev) => !prev);
  };

  return (
    <div
      className="lk-prejoin"
      data-lk-theme="default"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* Video preview area - Hidden for students and speech listeners */}
      {!shouldHideMedia && (
        <div
          className="lk-video-container w-full"
          style={{
            overflow: 'hidden',
            borderRadius: '8px',
            lineHeight: 0, // Eliminates any text baseline spacing
            backgroundColor: 'transparent',
          }}
        >
          {videoEnabled ? (
            <video
              ref={videoEl}
              className="lk-camera-preview"
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: '16 / 9',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              className="lk-camera-off-note"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                aspectRatio: '16 / 9',
                backgroundColor: 'transparent',
                borderRadius: '8px',
                color: '#666',
              }}
            >
              <CameraOff size={48} />
              <span style={{ marginTop: '0.5rem' }}>Camera is turned off</span>
            </div>
          )}
        </div>
      )}

      {/* Media controls - Hidden for students and speech listeners */}
      {!shouldHideMedia && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Microphone control */}
          <Select value={audioDeviceId} onValueChange={setAudioDeviceId}>
            <SelectTrigger className="h-12 w-auto border-transparent hover:border-[#4b5563]/30">
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleAudio();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleAudio();
                  }
                }}
                className="p-1 rounded transition-colors mr-2 cursor-pointer"
                style={
                  {
                    '--hover-bg': 'var(--lk-bg3)',
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lk-bg3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? (
                  <Mic size={24} style={{ color: 'var(--lk-text1, white)' }} />
                ) : (
                  <MicOff size={24} style={{ color: 'var(--lk-text2, #6b7280)' }} />
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              {audioDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Camera control */}
          <Select value={videoDeviceId} onValueChange={setVideoDeviceId}>
            <SelectTrigger className="h-12 w-auto border-transparent hover:border-[#4b5563]/30">
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleVideo();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleVideo();
                  }
                }}
                className="p-1 rounded transition-colors mr-2 cursor-pointer"
                style={
                  {
                    '--hover-bg': 'var(--lk-bg3)',
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lk-bg3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? (
                  <Camera size={24} style={{ color: 'var(--lk-text1, white)' }} />
                ) : (
                  <CameraOff size={24} style={{ color: 'var(--lk-text2, #6b7280)' }} />
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Camera'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Join form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Username input with floating label */}
        <FloatingLabelInput
          id="username"
          type="text"
          name="username"
          label="Your Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          autoFocus={false}
          required
        />

        {/* Language selector */}
        {showLanguageSelector && onLanguageChange && (
          <PreJoinLanguageSelect
            selectedLanguage={selectedLanguage}
            onLanguageChange={onLanguageChange}
            isTeacher={isTeacher}
          />
        )}

        {/* Translation language selector - teachers only */}
        {isTeacher && showLanguageSelector && onTranslationLanguageChange && (
          <PreJoinLanguageSelect
            selectedLanguage={selectedTranslationLanguage}
            onLanguageChange={onTranslationLanguageChange}
            isTeacher={false}
          />
        )}

        {/* Join button */}
        <Button
          as="button"
          type="submit"
          disabled={!username.trim()}
          borderRadius="1.75rem"
          containerClassName="w-full h-12"
          className={
            username.trim()
              ? 'bg-[#f1f2f4] dark:bg-[#111418] text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
              : 'bg-transparent text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
          }
          duration={3000}
        >
          Join Room
        </Button>
      </form>
    </div>
  );
}
