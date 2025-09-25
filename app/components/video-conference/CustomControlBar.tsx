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
  Hand,
  Clock,
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
    raiseHand?: boolean;
  };
  variation?: 'minimal' | 'verbose' | 'textOnly';
  className?: string;
  onSettingsClick?: () => void;
  onRaiseHandClick?: () => void;
  hasActiveRequest?: boolean;
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
    raiseHand: false,
  },
  variation = 'minimal',
  className,
  onSettingsClick,
  onRaiseHandClick,
  hasActiveRequest = false,
  isStudent = false,
}: CustomControlBarProps) {
  // Microphone toggle - using proper 'enabled' property from hook
  const {
    toggle: toggleMic,
    enabled: micEnabled,
    pending: micPending,
    buttonProps: micButtonProps
  } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  // Camera toggle - using proper 'enabled' property from hook
  const {
    toggle: toggleCamera,
    enabled: cameraEnabled,
    pending: cameraPending,
    buttonProps: cameraButtonProps
  } = useTrackToggle({
    source: Track.Source.Camera,
  });

  // Screen share toggle - already using isEnabled correctly
  const {
    toggle: toggleScreen,
    enabled: screenEnabled,
    pending: screenPending,
    buttonProps: screenButtonProps
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
    'transition-all duration-200',
    'text-white font-medium',
    'hover:scale-105 active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black',
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
        'flex items-center justify-center gap-2 p-4',
        'bg-black/80 backdrop-blur-sm',
        'border-t border-gray-800',
        className
      )}
    >
      {/* Microphone Button */}
      {controls.microphone && (
        <Button
          {...micButtonProps}
          variant={getButtonVariant(micEnabled)}
          size="lg"
          className={buttonClass}
          disabled={micPending}
        >
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
        >
          {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
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
        >
          {screenEnabled ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          {getButtonLabel('Share', screenEnabled, variation)}
        </Button>
      )}

      {/* Divider */}
      {(controls.microphone || controls.camera || controls.screenShare) &&
       (controls.chat || controls.settings || controls.leave) && (
        <div className="w-px h-8 bg-gray-700 mx-2" />
      )}

      {/* Chat Button */}
      {controls.chat && (
        <Button
          {...chatButtonProps}
          variant={layoutContext.widget.state?.showChat ? 'default' : 'secondary'}
          size="lg"
          className={buttonClass}
          aria-label={layoutContext.widget.state?.showChat ? 'Hide chat' : 'Show chat'}
        >
          <MessageSquare className="h-5 w-5" />
          {variation !== 'minimal' && 'Chat'}
        </Button>
      )}

      {/* Raise Hand Button - Only for Students */}
      {controls.raiseHand && isStudent && (
        <Button
          onClick={onRaiseHandClick}
          variant={hasActiveRequest ? 'default' : 'secondary'}
          size="lg"
          className={clsx(buttonClass, hasActiveRequest && 'animate-pulse')}
          disabled={hasActiveRequest}
          aria-label={hasActiveRequest ? 'Request pending' : 'Raise hand'}
          title={hasActiveRequest ? 'Your request is pending' : 'Ask a question'}
        >
          {hasActiveRequest ? <Clock className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
          {variation !== 'minimal' && (hasActiveRequest ? 'Pending' : 'Raise Hand')}
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
        >
          <Settings className="h-5 w-5" />
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
        >
          <PhoneOff className="h-5 w-5" />
          {variation !== 'minimal' && 'Leave'}
        </Button>
      )}
    </div>
  );
}