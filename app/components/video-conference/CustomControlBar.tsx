'use client';

import React from 'react';
import {
  useTrackToggle,
  useDisconnectButton,
  useChatToggle,
  useLayoutContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import clsx from 'clsx';

interface CustomControlBarProps {
  controls?: {
    microphone?: boolean;
    camera?: boolean;
    screenShare?: boolean;
    chat?: boolean;
    settings?: boolean;
    leave?: boolean;
    translation?: boolean;
  };
  variation?: 'minimal' | 'verbose' | 'textOnly';
  className?: string;
  onSettingsClick?: () => void;
  onTranslationClick?: () => void;
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
    'h-12 px-4 rounded-lg',
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
        'flex items-center justify-center gap-2 p-[5px] sm:p-4',
        'backdrop-blur-sm border-t',
        className,
      )}
      style={{
        backgroundColor: 'var(--lk-bg)',
        borderColor: 'var(--lk-bg3)',
      }}
    >
      {/* Microphone Button */}
      {controls.microphone && (
        <Button
          {...micButtonProps}
          variant={getButtonVariant(micEnabled)}
          size="lg"
          className={buttonClass}
          disabled={micPending}
          style={{
            backgroundColor: micEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          {micEnabled ? (
            <Mic className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
          ) : (
            <MicOff className="h-5 w-5" style={{ color: 'var(--lk-text2, #6b7280)' }} />
          )}
          {getButtonLabel('Mic', micEnabled, variation)}
        </Button>
      )}

      {/* Camera Button */}
      {controls.camera && (
        <Button
          {...cameraButtonProps}
          variant={getButtonVariant(cameraEnabled)}
          size="lg"
          className={buttonClass}
          disabled={cameraPending}
          style={{
            backgroundColor: cameraEnabled ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          {cameraEnabled ? (
            <Video className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
          ) : (
            <VideoOff className="h-5 w-5" style={{ color: 'var(--lk-text2, #6b7280)' }} />
          )}
          {getButtonLabel('Camera', cameraEnabled, variation)}
        </Button>
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
            <MonitorOff className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
          ) : (
            <Monitor className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
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
              ? 'var(--lk-bg4)'
              : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
          {variation !== 'minimal' && 'Chat'}
        </Button>
      )}

      {/* Translation Button - Only for Students */}
      {controls.translation && isStudent && (
        <Button
          onClick={onTranslationClick}
          variant={showTranslation ? 'default' : 'secondary'}
          size="lg"
          className={buttonClass}
          aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
          title={showTranslation ? 'Hide translation panel' : 'Show translation panel'}
          style={{
            backgroundColor: showTranslation ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
            color: 'var(--lk-text1, white)',
            borderColor: 'var(--lk-bg3)',
          }}
        >
          <Languages className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
          {variation !== 'minimal' && 'Translation'}
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
          <Settings className="h-5 w-5" style={{ color: 'var(--lk-text1, white)' }} />
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
          <PhoneOff className="h-5 w-5" style={{ color: 'white' }} />
          {variation !== 'minimal' && 'Leave'}
        </Button>
      )}
    </div>
  );
}
