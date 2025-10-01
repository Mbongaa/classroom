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
import { Input } from '@/components/ui/input';
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
  isTeacher?: boolean;
  isSpeechListener?: boolean;
}

export default function CustomPreJoin({
  onSubmit,
  onError,
  defaults,
  showLanguageSelector = false,
  selectedLanguage = '',
  onLanguageChange,
  isTeacher = false,
  isSpeechListener = false,
}: CustomPreJoinProps) {
  // State management
  const [username, setUsername] = React.useState(defaults?.username || '');
  // Force disable media for speech listeners
  const [videoEnabled, setVideoEnabled] = React.useState(
    isSpeechListener ? false : defaults?.videoEnabled !== undefined ? defaults.videoEnabled : true,
  );
  const [audioEnabled, setAudioEnabled] = React.useState(
    isSpeechListener ? false : defaults?.audioEnabled !== undefined ? defaults.audioEnabled : true,
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

  // Get media devices
  React.useEffect(() => {
    // Skip all media device setup for speech listeners
    if (isSpeechListener) return;

    const getDevices = async () => {
      try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        const audioInputs = devices.filter((device) => device.kind === 'audioinput');

        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);

        // Set default devices
        if (videoInputs.length > 0 && !videoDeviceId) {
          setVideoDeviceId(videoInputs[0].deviceId);
        }
        if (audioInputs.length > 0 && !audioDeviceId) {
          setAudioDeviceId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to get media devices:', error);
      }
    };

    getDevices();
  }, [isSpeechListener]);

  // Initialize video track
  React.useEffect(() => {
    // Skip video track initialization for speech listeners
    if (isSpeechListener) return;

    let track: any = null;

    const initVideoTrack = async () => {
      if (videoEnabled && videoDeviceId) {
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
      } else if (localVideoTrack) {
        localVideoTrack.stop();
        setLocalVideoTrack(null);
      }
    };

    initVideoTrack();

    return () => {
      if (track) {
        track.stop();
      }
    };
  }, [videoEnabled, videoDeviceId]);

  // Initialize audio track
  React.useEffect(() => {
    // Skip audio track initialization for speech listeners
    if (isSpeechListener) return;

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
      } else if (localAudioTrack) {
        localAudioTrack.stop();
        setLocalAudioTrack(null);
      }
    };

    initAudioTrack();

    return () => {
      if (track) {
        track.stop();
      }
    };
  }, [audioEnabled, audioDeviceId, isSpeechListener]);

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
      {/* Video preview area - Hidden for speech listeners */}
      {!isSpeechListener && (
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

      {/* Media controls - Hidden for speech listeners */}
      {!isSpeechListener && (
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
        {/* Username input */}
        <Input
          id="username"
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          className="focus:ring-4 focus:ring-[#434549] focus:ring-offset-1 focus:ring-offset-[#b8b2b2] hover:border-[#6b7280]"
        />

        {/* Language selector */}
        {showLanguageSelector && onLanguageChange && (
          <PreJoinLanguageSelect
            selectedLanguage={selectedLanguage}
            onLanguageChange={onLanguageChange}
            isTeacher={isTeacher}
          />
        )}

        {/* Join button */}
        <Button
          as="button"
          type="submit"
          disabled={!username.trim()}
          borderRadius="1.75rem"
          containerClassName="w-full h-12"
          className="bg-white dark:bg-black text-black dark:text-white border-gray-300 dark:border-gray-700 text-lg font-medium"
          duration={3000}
        >
          Join Room
        </Button>
      </form>
    </div>
  );
}
