'use client';

import React from 'react';
import {
  useTrackToggle,
  useDisconnectButton,
  useChatToggle,
  useLayoutContext,
  useMediaDeviceSelect,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  PhoneOff,
  Settings,
  Languages,
  Circle,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

const LS_AUDIO_DEVICE_KEY = 'bayaan-preferred-audio-device';
const LS_VIDEO_DEVICE_KEY = 'bayaan-preferred-video-device';

interface CustomControlBarProps {
  controls?: {
    microphone?: boolean;
    camera?: boolean;
    screenShare?: boolean;
    chat?: boolean;
    settings?: boolean;
    leave?: boolean;
    translation?: boolean;
    record?: boolean;
  };
  variation?: 'minimal' | 'verbose' | 'textOnly';
  className?: string;
  onSettingsClick?: () => void;
  onTranslationClick?: () => void;
  onRecordClick?: () => void;
  isRecording?: boolean;
  recordingLoading?: boolean;
  showTranslation?: boolean;
  isStudent?: boolean;
}

export function CustomControlBar({
  controls = {
    microphone: true,
    camera: true,
    screenShare: true,
    chat: true,
    settings: false,
    leave: true,
    translation: false,
  },
  variation = 'minimal',
  className,
  onSettingsClick,
  onTranslationClick,
  onRecordClick,
  isRecording = false,
  recordingLoading = false,
  showTranslation = false,
  isStudent = false,
}: CustomControlBarProps) {
  // Microphone toggle - using proper 'enabled' property from hook
  const {
    toggle: toggleMic,
    enabled: micEnabled,
    pending: micPending,
    buttonProps: micButtonProps,
  } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  // Camera toggle - using proper 'enabled' property from hook
  const {
    toggle: toggleCamera,
    enabled: cameraEnabled,
    pending: cameraPending,
    buttonProps: cameraButtonProps,
  } = useTrackToggle({
    source: Track.Source.Camera,
  });

  // Media device selectors for in-room switching
  const {
    devices: micDevices,
    activeDeviceId: activeMicId,
    setActiveMediaDevice: setActiveMic,
  } = useMediaDeviceSelect({ kind: 'audioinput' });

  const {
    devices: cameraDevices,
    activeDeviceId: activeCameraId,
    setActiveMediaDevice: setActiveCamera,
  } = useMediaDeviceSelect({ kind: 'videoinput' });

  // Screen share toggle - already using isEnabled correctly
  const {
    toggle: toggleScreen,
    enabled: screenEnabled,
    pending: screenPending,
    buttonProps: screenButtonProps,
  } = useTrackToggle({
    source: Track.Source.ScreenShare,
  });

  // Chat toggle
  const layoutContext = useLayoutContext();
  const { mergedProps: chatButtonProps } = useChatToggle({ props: {} });

  // Disconnect button
  const { buttonProps: disconnectButtonProps } = useDisconnectButton({});

  const buttonClass = clsx(
    'relative inline-flex items-center justify-center',
    'h-10 px-3 rounded-lg',
    'font-medium',
  );

  const getButtonVariant = (isEnabled: boolean, isDanger: boolean = false) => {
    if (isDanger) return 'destructive';
    return isEnabled ? 'default' : 'secondary';
  };

  const getButtonLabel = (label: string, isEnabled: boolean, variation: string) => {
    if (variation === 'textOnly') return label;
    if (variation === 'verbose') return `${label} ${isEnabled ? 'On' : 'Off'}`;
    return '';
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-1.5',
        'backdrop-blur-sm',
        className,
      )}
      style={{
        backgroundColor: 'var(--lk-bg)',
        borderColor: 'var(--lk-bg3)',
      }}
    >
      {/* Microphone Button + Device Selector */}
      {controls.microphone && (
        <div className="flex items-center">
          <Button
            {...micButtonProps}
            variant={getButtonVariant(micEnabled)}
            size="lg"
            className={clsx(buttonClass, 'rounded-r-none border-r-0')}
            disabled={micPending}
            style={{
              backgroundColor: micEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
              color: 'var(--lk-text1, white)',
              borderColor: 'var(--lk-bg3)',
            }}
          >
            {micEnabled ? (
              <Mic className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text1, white)' }} />
            ) : (
              <MicOff className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text2, #6b7280)' }} />
            )}
            {getButtonLabel('Mic', micEnabled, variation)}
          </Button>
          <Select
            value={activeMicId}
            onValueChange={async (id) => {
              const previousId = activeMicId;
              try {
                await setActiveMic(id);
                try { localStorage.setItem(LS_AUDIO_DEVICE_KEY, id); } catch {}
              } catch (err) {
                console.error('[ControlBar] Failed to switch microphone:', err);
                if (previousId && previousId !== id) {
                  setActiveMic(previousId).catch(() => {});
                }
                alert('Could not switch microphone. The previous device is still active.');
              }
            }}
          >
            <SelectTrigger
              className="h-10 w-8 px-0 rounded-l-none border-l-0 justify-center [&>svg:last-child]:hidden"
              style={{
                backgroundColor: micEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)',
              }}
            >
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </SelectTrigger>
            <SelectContent>
              {micDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Camera Button + Device Selector */}
      {controls.camera && (
        <div className="flex items-center">
          <Button
            {...cameraButtonProps}
            variant={getButtonVariant(cameraEnabled)}
            size="lg"
            className={clsx(buttonClass, 'rounded-r-none border-r-0')}
            disabled={cameraPending}
            style={{
              backgroundColor: cameraEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
              color: 'var(--lk-text1, white)',
              borderColor: 'var(--lk-bg3)',
            }}
          >
            {cameraEnabled ? (
              <Video className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text1, white)' }} />
            ) : (
              <VideoOff className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text2, #6b7280)' }} />
            )}
            {getButtonLabel('Camera', cameraEnabled, variation)}
          </Button>
          <Select
            value={activeCameraId}
            onValueChange={async (id) => {
              const previousId = activeCameraId;
              try {
                await setActiveCamera(id);
                try { localStorage.setItem(LS_VIDEO_DEVICE_KEY, id); } catch {}
              } catch (err) {
                console.error('[ControlBar] Failed to switch camera:', err);
                if (previousId && previousId !== id) {
                  setActiveCamera(previousId).catch(() => {});
                }
                alert('Could not switch camera. The previous device is still active.');
              }
            }}
          >
            <SelectTrigger
              className="h-10 w-8 px-0 rounded-l-none border-l-0 justify-center [&>svg:last-child]:hidden"
              style={{
                backgroundColor: cameraEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)',
              }}
            >
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </SelectTrigger>
            <SelectContent>
              {cameraDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Camera'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Screen Share Button */}
      {controls.screenShare && (
        <Button
          {...screenButtonProps}
          variant={getButtonVariant(screenEnabled)}
          size="lg"
          className={buttonClass}
          disabled={screenPending}
          style={{
            backgroundColor: screenEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          {screenEnabled ? (
            <MonitorOff className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text1, white)' }} />
          ) : (
            <Monitor className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text1, white)' }} />
          )}
          {getButtonLabel('Share', screenEnabled, variation)}
        </Button>
      )}

      {/* Divider */}
      {(controls.microphone || controls.camera || controls.screenShare) &&
        (controls.chat || controls.settings || controls.leave) && (
          <div className="w-px h-8 mx-2" style={{ backgroundColor: 'var(--lk-bg3)' }} />
        )}

      {/* Chat Button */}
      {controls.chat && (
        <Button
          {...chatButtonProps}
          variant={layoutContext.widget.state?.showChat ? 'default' : 'secondary'}
          size="lg"
          className={buttonClass}
          aria-label={layoutContext.widget.state?.showChat ? 'Hide chat' : 'Show chat'}
          style={{
            backgroundColor: layoutContext.widget.state?.showChat
              ? 'rgba(34, 197, 94, 0.2)'
              : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: layoutContext.widget.state?.showChat
              ? 'rgba(34, 197, 94, 0.4)'
              : 'var(--lk-bg3)',
          }}
        >
          <MessageSquare className="h-[18px] w-[18px]" style={{ color: '#22c55e' }} />
          {variation !== 'minimal' && 'Chat'}
        </Button>
      )}

      {/* Translation Button */}
      {controls.translation && (
        <Button
          onClick={onTranslationClick}
          variant={showTranslation ? 'default' : 'secondary'}
          size="lg"
          className={buttonClass}
          aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
          title={showTranslation ? 'Hide translation panel' : 'Show translation panel'}
          style={{
            backgroundColor: showTranslation ? 'rgba(59, 130, 246, 0.2)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: showTranslation ? 'rgba(59, 130, 246, 0.4)' : 'var(--lk-bg3)',
          }}
        >
          <Languages className="h-[18px] w-[18px]" style={{ color: '#3b82f6' }} />
          {variation !== 'minimal' && 'Translation'}
        </Button>
      )}

      {/* Record Button */}
      {controls.record && (
        <Button
          onClick={onRecordClick}
          variant={isRecording ? 'default' : 'secondary'}
          size="lg"
          className={buttonClass}
          disabled={recordingLoading}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          title={recordingLoading ? 'Please wait...' : isRecording ? 'Stop recording' : 'Start recording'}
          style={{
            backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: isRecording ? 'rgba(239, 68, 68, 0.4)' : 'var(--lk-bg3)',
            opacity: recordingLoading ? 0.6 : 1,
          }}
        >
          <Circle
            className={`h-[18px] w-[18px] ${isRecording ? 'animate-pulse' : ''}`}
            style={{ color: '#ef4444' }}
            fill={isRecording ? '#ef4444' : 'none'}
            strokeWidth={isRecording ? 0 : 2}
          />
          {variation !== 'minimal' && (isRecording ? 'Stop' : 'Record')}
        </Button>
      )}

      {/* Settings Button */}
      {controls.settings && (
        <Button
          onClick={onSettingsClick}
          variant="secondary"
          size="lg"
          className={buttonClass}
          aria-label="Settings"
          style={{
            backgroundColor: 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          <Settings className="h-[18px] w-[18px]" style={{ color: 'var(--lk-text1, white)' }} />
          {variation !== 'minimal' && 'Settings'}
        </Button>
      )}

      {/* Leave Button */}
      {controls.leave && (
        <Button
          {...disconnectButtonProps}
          variant="destructive"
          size="lg"
          className={clsx(buttonClass, 'ml-4')}
          aria-label="Leave meeting"
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            borderColor: '#dc2626',
          }}
        >
          <PhoneOff className="h-[18px] w-[18px]" style={{ color: 'white' }} />
          {variation !== 'minimal' && 'Leave'}
        </Button>
      )}
    </div>
  );
}
