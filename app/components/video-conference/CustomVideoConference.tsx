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
  const [chatSidebarWidth, setChatSidebarWidth] = React.useState(320);
  const [isResizingChat, setIsResizingChat] = React.useState(false);

  // Auto-switch to focus layout when screen share starts
  React.useEffect(() => {
    const hasScreenShare = tracks.some(track =>
      track.publication?.source === Track.Source.ScreenShare
    );

    if (hasScreenShare && layoutMode === 'grid') {
      setLayoutMode('focus');
    }
  }, [tracks, layoutMode]);

  // Chat resize handlers
  const handleChatMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingChat(true);
  }, []);

  const handleChatMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizingChat) return;

    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 250 && newWidth <= 600) {
      setChatSidebarWidth(newWidth);
    }
  }, [isResizingChat]);

  const handleChatMouseUp = React.useCallback(() => {
    setIsResizingChat(false);
  }, []);

  React.useEffect(() => {
    if (isResizingChat) {
      document.addEventListener('mousemove', handleChatMouseMove);
      document.addEventListener('mouseup', handleChatMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      return () => {
        document.removeEventListener('mousemove', handleChatMouseMove);
        document.removeEventListener('mouseup', handleChatMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizingChat, handleChatMouseMove, handleChatMouseUp]);

  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <div className="text-6xl mb-4">🔌</div>
          <p className="text-white text-lg">Disconnected from room</p>
          <p className="text-gray-400 text-sm mt-2">Please refresh the page to reconnect</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full bg-black', className)}>
      {/* Connection state toast */}
      <ConnectionStateToast />

      {/* Layout switcher (top bar) */}
      {showLayoutSwitcher && (
        <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Button
              variant={layoutMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('grid')}
              className="h-8"
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Grid
            </Button>
            <Button
              variant={layoutMode === 'focus' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('focus')}
              className="h-8"
            >
              <Users className="w-4 h-4 mr-1" />
              Focus
            </Button>
            <Button
              variant={layoutMode === 'spotlight' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setLayoutMode('spotlight')}
              className="h-8"
            >
              <Presentation className="w-4 h-4 mr-1" />
              Spotlight
            </Button>
          </div>

          <div className="text-sm text-gray-400">
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
            className="absolute right-0 top-0 bottom-0 z-10 border-l border-gray-800 bg-black shadow-2xl"
            style={{ width: `${chatSidebarWidth}px` }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
              onMouseDown={handleChatMouseDown}
            />

            {/* Chat header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-black">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-white font-medium">Chat</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => widget.dispatch?.({ msg: 'toggle_chat' })}
                className="h-6 w-6 p-0 hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
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
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <SettingsComponent />
            <Button
              onClick={() => setShowSettings(false)}
              className="mt-4 w-full"
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