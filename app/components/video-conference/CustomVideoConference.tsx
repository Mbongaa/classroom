'use client';

import React from 'react';
import {
  RoomAudioRenderer,
  ConnectionStateToast,
  Chat,
  useLayoutContext,
  useConnectionState,
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { CustomControlBar } from './CustomControlBar';
import { CustomVideoLayouts } from './CustomVideoLayouts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { Button } from '@/components/ui/button';
import { useResizable } from '@/lib/useResizable';
import { Grid3X3, Users, Presentation, MessageSquare, X } from 'lucide-react';
import clsx from 'clsx';

interface CustomVideoConferenceProps {
  chatMessageFormatter?: (message: string) => string;
  SettingsComponent?: React.ComponentType<any>;
  showLayoutSwitcher?: boolean;
  defaultLayout?: 'grid' | 'focus' | 'spotlight';
  className?: string;
}

export function CustomVideoConference({
  chatMessageFormatter,
  SettingsComponent,
  showLayoutSwitcher = true,
  defaultLayout = 'grid',
  className,
}: CustomVideoConferenceProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { widget } = useLayoutContext();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const [layoutMode, setLayoutMode] = React.useState<'grid' | 'focus' | 'spotlight'>(defaultLayout);
  const [showSettings, setShowSettings] = React.useState(false);
  const chatResize = useResizable({
    initialWidth: 320,
    minWidth: 250,
    maxWidth: 600,
    widthCalculation: (clientX: number) => window.innerWidth - clientX, // Right-edge resize
  });

  // Auto-switch to focus layout when screen share starts
  React.useEffect(() => {
    const hasScreenShare = tracks.some(track =>
      track.publication?.source === Track.Source.ScreenShare
    );

    if (hasScreenShare && layoutMode === 'grid') {
      setLayoutMode('focus');
    }
  }, [tracks, layoutMode]);


  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--lk-bg)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4"
            style={{ borderColor: 'var(--lk-text1, white)' }}
          ></div>
          <p className="text-lg" style={{ color: 'var(--lk-text1, white)' }}>
            Connecting to room...
          </p>
        </div>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--lk-bg)' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🔌</div>
          <p className="text-lg" style={{ color: 'var(--lk-text1, white)' }}>
            Disconnected from room
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--lk-text2, #6b7280)' }}>
            Please refresh the page to reconnect
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('flex flex-col h-full', className)}
      style={{ backgroundColor: 'var(--lk-bg)' }}
    >
      {/* Connection state toast */}
      <ConnectionStateToast />

      {/* Layout switcher (top bar) */}
      {showLayoutSwitcher && (
        <div
          className="flex items-center justify-between p-2 border-b"
          style={{
            backgroundColor: 'var(--lk-bg2)',
            borderColor: 'var(--lk-bg3)'
          }}
        >
          <div className="flex items-center gap-2">
            <Button
              variant={layoutMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('grid')}
              className="h-8"
              style={{
                backgroundColor: layoutMode === 'grid' ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)'
              }}
            >
              <Grid3X3 className="w-4 h-4 mr-1" style={{ color: 'var(--lk-text1, white)' }} />
              Grid
            </Button>
            <Button
              variant={layoutMode === 'focus' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('focus')}
              className="h-8"
              style={{
                backgroundColor: layoutMode === 'focus' ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)'
              }}
            >
              <Users className="w-4 h-4 mr-1" style={{ color: 'var(--lk-text1, white)' }} />
              Focus
            </Button>
            <Button
              variant={layoutMode === 'spotlight' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('spotlight')}
              className="h-8"
              style={{
                backgroundColor: layoutMode === 'spotlight' ? 'var(--lk-bg4)' : 'var(--lk-bg2)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)'
              }}
            >
              <Presentation className="w-4 h-4 mr-1" style={{ color: 'var(--lk-text1, white)' }} />
              Spotlight
            </Button>
          </div>

          <div className="text-sm" style={{ color: 'var(--lk-text2, #6b7280)' }}>
            {tracks.length} participant{tracks.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Video area - always full width */}
        <div className="w-full h-full relative">
          <CustomVideoLayouts
            layoutMode={layoutMode}
            className="h-full"
          />
        </div>

        {/* Chat sidebar - overlay positioned */}
        {widget.state?.showChat && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 border-l shadow-2xl"
            style={{
              width: `${chatResize.width}px`,
              backgroundColor: 'var(--lk-bg)',
              borderColor: 'var(--lk-bg3)'
            }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
              style={{ backgroundColor: 'var(--lk-bg3)' }}
              onMouseDown={chatResize.handleMouseDown}
            />

            {/* Chat header */}
            <div
              className="flex items-center justify-between p-3 border-b"
              style={{
                backgroundColor: 'var(--lk-bg2)',
                borderColor: 'var(--lk-bg3)'
              }}
            >
              <div className="flex items-center gap-2">
                <MessageSquare
                  className="w-4 h-4"
                  style={{ color: 'var(--lk-text2, #6b7280)' }}
                />
                <span className="font-medium" style={{ color: 'var(--lk-text1, white)' }}>
                  Chat
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => widget.dispatch?.({ msg: 'toggle_chat' })}
                className="h-6 w-6 p-0"
                style={{
                  color: 'var(--lk-text1, white)',
                  '&:hover': { backgroundColor: 'var(--lk-bg3)' }
                }}
              >
                <X className="w-4 h-4" style={{ color: 'var(--lk-text1, white)' }} />
              </Button>
            </div>

            {/* Chat component */}
            <Chat
              className="h-[calc(100%-49px)]"
              messageFormatter={chatMessageFormatter}
            />
          </div>
        )}
      </div>

      {/* Control bar */}
      <CustomControlBar
        controls={{
          microphone: true,
          camera: true,
          screenShare: true,
          chat: true,
          settings: !!SettingsComponent,
          leave: true,
        }}
        variation="minimal"
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* Settings modal */}
      {SettingsComponent && showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className="rounded-lg p-6 max-w-md w-full"
            style={{ backgroundColor: 'var(--lk-bg2)' }}
          >
            <SettingsComponent />
            <Button
              onClick={() => setShowSettings(false)}
              className="mt-4 w-full"
              style={{
                backgroundColor: 'var(--lk-bg4)',
                color: 'var(--lk-text1, white)',
                borderColor: 'var(--lk-bg3)'
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Critical: Audio renderer - must always be included! */}
      <RoomAudioRenderer />
    </div>
  );
}