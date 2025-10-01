# LiveKit Custom UI Integration Guide

## Table of Contents

1. [Introduction: Why CSS Overrides Don't Work](#introduction-why-css-overrides-dont-work)
2. [The LiveKit Philosophy](#the-livekit-philosophy)
3. [Understanding the Hook and Component Pattern](#understanding-the-hook-and-component-pattern)
4. [Core Hooks Reference](#core-hooks-reference)
5. [Step-by-Step Examples](#step-by-step-examples)
6. [Integration with UI Libraries](#integration-with-ui-libraries)
7. [Advanced Composition Patterns](#advanced-composition-patterns)
8. [Best Practices](#best-practices)
9. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

---

## Introduction: Why CSS Overrides Don't Work

### The Problem with CSS Overrides

When you try to override LiveKit components using global CSS like this:

```css
/* This WILL NOT work */
button {
  background-color: blue !important;
}

.my-custom-button {
  /* This will be overridden by LiveKit's CSS */
}
```

**It fails because:**

1. **CSS Modules Scoping**: LiveKit uses CSS modules that generate highly specific class names like `.lk-control-bar-button-xyz`
2. **Specificity Wars**: Generic rules like `button { ... }` will never override `.lk-control-bar-button-xyz { ... }`
3. **Maintenance Nightmare**: Even if you win the specificity battle with `!important`, you're fighting the framework

### The Architectural Intent

This is **intentional design**. LiveKit prevents CSS fights to encourage proper component composition. The library is built to be:

- **Logically Reusable**: Hooks provide all the WebRTC logic
- **Visually Replaceable**: You bring your own UI components
- **Framework Agnostic**: Works with any UI library or design system

---

## The LiveKit Philosophy

> **"We provide the logic, you provide the presentation."**

This philosophy means:

- **LiveKit Manages**: WebRTC complexity, state management, real-time synchronization
- **You Control**: Visual design, user experience, brand consistency
- **Result**: Complete visual freedom without reimplementing complex WebRTC logic

### The Separation of Concerns

```typescript
// ❌ Wrong: Fighting with LiveKit's components
<TrackToggle source={Track.Source.Microphone} className="my-style" />

// ✅ Right: Using LiveKit's logic with your UI
const { toggle, isEnabled } = useTrackToggle({ source: Track.Source.Microphone });
return <YourCustomButton onClick={toggle} active={isEnabled} />;
```

---

## Understanding the Hook and Component Pattern

### The Pattern Explained

Every LiveKit UI component has a corresponding hook that provides its logic:

| Component            | Hook                    | Purpose                   |
| -------------------- | ----------------------- | ------------------------- |
| `<TrackToggle>`      | `useTrackToggle()`      | Toggle audio/video tracks |
| `<DisconnectButton>` | `useDisconnectButton()` | Leave room functionality  |
| `<Chat>`             | `useChat()`             | Chat messaging logic      |
| `<ParticipantTile>`  | `useParticipantTile()`  | Participant display logic |
| `<ControlBar>`       | Multiple hooks          | Composite control logic   |

### How Hooks Work

Hooks provide:

1. **State**: Current status (enabled/disabled, muted/unmuted)
2. **Actions**: Functions to trigger changes (toggle, send, disconnect)
3. **Props**: Accessibility and HTML attributes
4. **Events**: Callbacks for user interactions

---

## Core Hooks Reference

### Track Control Hooks

#### `useTrackToggle()`

Controls microphone, camera, or screen share.

```typescript
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';

function CustomMicButton() {
  const { toggle, isEnabled, buttonProps } = useTrackToggle({
    source: Track.Source.Microphone,
    captureOptions: { /* audio settings */ },
    publishOptions: { /* publish settings */ },
  });

  return (
    <button {...buttonProps} onClick={toggle}>
      {isEnabled ? 'Mute' : 'Unmute'}
    </button>
  );
}
```

#### `useTracks()`

Subscribe to and manage multiple tracks.

```typescript
const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
  onlySubscribed: false,
});
```

### Participant Management Hooks

#### `useParticipants()`

Get all participants in the room.

```typescript
const participants = useParticipants();
// Returns array of all participants
```

#### `useLocalParticipant()`

Access the local participant.

```typescript
const { localParticipant, isConnected } = useLocalParticipant();
```

#### `useRemoteParticipants()`

Get only remote participants.

```typescript
const remoteParticipants = useRemoteParticipants();
```

### Communication Hooks

#### `useChat()`

Complete chat functionality.

```typescript
const { send, chatMessages, isSending } = useChat();

const sendMessage = async (text: string) => {
  await send(text);
};
```

#### `useDataChannel()`

Send custom data between participants.

```typescript
const { send } = useDataChannel('custom-topic', (msg) => {
  console.log('Received:', msg.payload);
});
```

### Media Device Hooks

#### `useMediaDevices()`

List available devices.

```typescript
const devices = useMediaDevices({ kind: 'videoinput' });
```

#### `useMediaDeviceSelect()`

Device selection with switching.

```typescript
const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
  kind: 'audioinput',
  room,
});
```

### Room and Connection Hooks

#### `useRoomContext()`

Access the Room instance.

```typescript
const room = useRoomContext();
```

#### `useConnectionState()`

Monitor connection status.

```typescript
const connectionState = useConnectionState();
// 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
```

### Layout and UI Hooks

#### `useLayoutContext()`

Manage layout state like pinning.

```typescript
const { pin, widget } = useLayoutContext();
```

#### `useFocusToggle()`

Focus/spotlight functionality.

```typescript
const { mergedProps, inFocus } = useFocusToggle({ trackRef });
```

---

## Step-by-Step Examples

### Example 1: Replace Microphone Button with Custom Component

#### Step 1: Install Dependencies

```bash
pnpm install lucide-react  # For icons
```

#### Step 2: Create Custom Component

```typescript
// components/CustomMicButton.tsx
'use client';

import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Mic, MicOff } from 'lucide-react';

export function CustomMicButton() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  return (
    <button
      onClick={toggle}
      className={`
        px-4 py-2 rounded-lg transition-all duration-200
        ${isEnabled
          ? 'bg-green-500 hover:bg-green-600'
          : 'bg-red-500 hover:bg-red-600'
        }
        text-white font-medium
        flex items-center gap-2
      `}
    >
      {isEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      {isEnabled ? 'Mute' : 'Unmute'}
    </button>
  );
}
```

#### Step 3: Use in Your Layout

```typescript
// Instead of LiveKit's VideoConference, compose your own
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { CustomMicButton } from './CustomMicButton';

export function CustomVideoConference() {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

  return (
    <div className="h-full flex flex-col">
      {/* Main video grid */}
      <GridLayout tracks={tracks} className="flex-grow">
        <ParticipantTile />
      </GridLayout>

      {/* Custom control bar */}
      <div className="p-4 bg-gray-900 flex justify-center gap-4">
        <CustomMicButton />
        {/* Add more custom controls */}
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
```

### Example 2: Custom Control Bar with Multiple Controls

```typescript
// components/CustomControlBar.tsx
import {
  useTrackToggle,
  useDisconnectButton,
  useChatToggle,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Mic, MicOff,
  Video, VideoOff,
  MessageSquare,
  PhoneOff,
  Monitor,
  MonitorOff
} from 'lucide-react';

export function CustomControlBar() {
  // Microphone toggle
  const micToggle = useTrackToggle({
    source: Track.Source.Microphone,
  });

  // Camera toggle
  const cameraToggle = useTrackToggle({
    source: Track.Source.Camera,
  });

  // Screen share toggle
  const screenToggle = useTrackToggle({
    source: Track.Source.ScreenShare,
  });

  // Chat toggle
  const { mergedProps: chatProps } = useChatToggle({ props: {} });

  // Disconnect button
  const { buttonProps: disconnectProps } = useDisconnectButton({});

  return (
    <div className="control-bar">
      {/* Microphone */}
      <button
        onClick={micToggle.toggle}
        className={`control-button ${micToggle.isEnabled ? 'active' : ''}`}
      >
        {micToggle.isEnabled ? <Mic /> : <MicOff />}
      </button>

      {/* Camera */}
      <button
        onClick={cameraToggle.toggle}
        className={`control-button ${cameraToggle.isEnabled ? 'active' : ''}`}
      >
        {cameraToggle.isEnabled ? <Video /> : <VideoOff />}
      </button>

      {/* Screen Share */}
      <button
        onClick={screenToggle.toggle}
        className={`control-button ${screenToggle.isEnabled ? 'active' : ''}`}
      >
        {screenToggle.isEnabled ? <MonitorOff /> : <Monitor />}
      </button>

      {/* Chat */}
      <button {...chatProps} className="control-button">
        <MessageSquare />
      </button>

      {/* Leave */}
      <button {...disconnectProps} className="control-button danger">
        <PhoneOff />
      </button>
    </div>
  );
}
```

### Example 3: Custom Participant Tile

```typescript
// components/CustomParticipantTile.tsx
import {
  useParticipantTile,
  VideoTrack,
  AudioTrack,
  TrackReference,
  isTrackReference
} from '@livekit/components-react';
import { Track } from 'livekit-client';

interface CustomParticipantTileProps {
  trackRef: TrackReference;
}

export function CustomParticipantTile({ trackRef }: CustomParticipantTileProps) {
  const { elementProps } = useParticipantTile({
    trackRef,
    onParticipantClick: (event) => {
      console.log('Clicked participant:', event.participant.identity);
    },
  });

  const participant = trackRef.participant;
  const videoTrack = trackRef.publication?.track;
  const audioTrack = participant.audioTracks[0]?.track;

  return (
    <div {...elementProps} className="participant-tile">
      {/* Video */}
      {videoTrack && trackRef.source === Track.Source.Camera && (
        <VideoTrack trackRef={trackRef} className="video-track" />
      )}

      {/* Audio (invisible but necessary) */}
      {audioTrack && (
        <AudioTrack trackRef={{
          participant,
          source: Track.Source.Microphone,
          publication: participant.audioTracks[0]
        }} />
      )}

      {/* Custom overlay */}
      <div className="participant-info">
        <span className="participant-name">{participant.name}</span>
        <ConnectionQualityIndicator participant={participant} />
      </div>
    </div>
  );
}
```

---

## Integration with UI Libraries

### Shadcn/ui Integration

#### Setup

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add toggle
```

#### Implementation

```typescript
// components/ShadcnMicToggle.tsx
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

export function ShadcnMicToggle() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  return (
    <Button
      variant={isEnabled ? 'default' : 'destructive'}
      size="lg"
      onClick={toggle}
    >
      {isEnabled ? <Mic className="mr-2" /> : <MicOff className="mr-2" />}
      {isEnabled ? 'Mute' : 'Unmute'}
    </Button>
  );
}
```

### Material-UI Integration

```typescript
// components/MuiControlBar.tsx
import {
  IconButton,
  Stack,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
} from '@mui/icons-material';
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function MuiControlBar() {
  const micToggle = useTrackToggle({
    source: Track.Source.Microphone,
  });

  const cameraToggle = useTrackToggle({
    source: Track.Source.Camera,
  });

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Tooltip title={micToggle.isEnabled ? 'Mute' : 'Unmute'}>
          <IconButton
            onClick={micToggle.toggle}
            color={micToggle.isEnabled ? 'primary' : 'error'}
          >
            {micToggle.isEnabled ? <Mic /> : <MicOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={cameraToggle.isEnabled ? 'Turn off camera' : 'Turn on camera'}>
          <IconButton
            onClick={cameraToggle.toggle}
            color={cameraToggle.isEnabled ? 'primary' : 'error'}
          >
            {cameraToggle.isEnabled ? <Videocam /> : <VideocamOff />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
```

### Tailwind CSS Best Practices

```typescript
// components/TailwindControlBar.tsx
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import clsx from 'clsx';

export function TailwindControlBar() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  const buttonClasses = clsx(
    // Base styles
    'px-6 py-3 rounded-full font-semibold transition-all duration-200',
    'flex items-center gap-2 shadow-lg',

    // State-based styles
    {
      'bg-green-500 hover:bg-green-600 text-white': isEnabled,
      'bg-gray-700 hover:bg-gray-600 text-gray-300': !isEnabled,
      'ring-2 ring-offset-2 ring-offset-gray-900': isEnabled,
      'ring-green-400': isEnabled,
    }
  );

  return (
    <button onClick={toggle} className={buttonClasses}>
      <span className={clsx(
        'w-2 h-2 rounded-full',
        isEnabled ? 'bg-white animate-pulse' : 'bg-gray-500'
      )} />
      {isEnabled ? 'Microphone On' : 'Microphone Off'}
    </button>
  );
}
```

---

## Advanced Composition Patterns

### Pattern 1: Composable Layouts

Instead of using the monolithic `<VideoConference>`, compose your layout:

```typescript
// layouts/ComposableVideoLayout.tsx
import {
  LayoutContextProvider,
  CarouselLayout,
  FocusLayout,
  GridLayout,
  useTracks,
  ControlBar,
  Chat,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState } from 'react';

type LayoutMode = 'grid' | 'focus' | 'carousel';

export function ComposableVideoLayout() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [showChat, setShowChat] = useState(false);

  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

  const renderLayout = () => {
    switch (layoutMode) {
      case 'focus':
        return <FocusLayout tracks={tracks} />;
      case 'carousel':
        return <CarouselLayout tracks={tracks} />;
      default:
        return (
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        );
    }
  };

  return (
    <LayoutContextProvider>
      <div className="video-container">
        {/* Layout switcher */}
        <div className="layout-controls">
          <button onClick={() => setLayoutMode('grid')}>Grid</button>
          <button onClick={() => setLayoutMode('focus')}>Focus</button>
          <button onClick={() => setLayoutMode('carousel')}>Carousel</button>
        </div>

        {/* Dynamic layout */}
        <div className="layout-area">
          {renderLayout()}
        </div>

        {/* Sidebar */}
        {showChat && (
          <aside className="chat-sidebar">
            <Chat />
          </aside>
        )}

        {/* Custom controls */}
        <div className="controls">
          <ControlBar
            variation="minimal"
            controls={{ chat: false }} // We handle chat separately
          />
          <button onClick={() => setShowChat(!showChat)}>
            Toggle Chat
          </button>
        </div>

        <RoomAudioRenderer />
      </div>
    </LayoutContextProvider>
  );
}
```

### Pattern 2: Custom Track Renderer

```typescript
// components/CustomTrackRenderer.tsx
import {
  TrackReferenceOrPlaceholder,
  isTrackReference,
  VideoTrack,
  AudioTrack
} from '@livekit/components-react';
import { Track } from 'livekit-client';

interface CustomTrackRendererProps {
  track: TrackReferenceOrPlaceholder;
  showOverlay?: boolean;
  showStats?: boolean;
}

export function CustomTrackRenderer({
  track,
  showOverlay = true,
  showStats = false
}: CustomTrackRendererProps) {
  if (!isTrackReference(track)) {
    return <PlaceholderView />;
  }

  const isVideo = track.source === Track.Source.Camera ||
                  track.source === Track.Source.ScreenShare;
  const isAudio = track.source === Track.Source.Microphone;

  return (
    <div className="track-container">
      {isVideo && (
        <VideoTrack
          trackRef={track}
          onError={(error) => console.error('Video error:', error)}
        />
      )}

      {isAudio && (
        <AudioTrack
          trackRef={track}
          onError={(error) => console.error('Audio error:', error)}
        />
      )}

      {showOverlay && (
        <TrackOverlay
          participant={track.participant}
          showStats={showStats}
        />
      )}
    </div>
  );
}

function PlaceholderView() {
  return (
    <div className="placeholder">
      <div className="avatar-placeholder" />
      <span>No video</span>
    </div>
  );
}

function TrackOverlay({ participant, showStats }) {
  return (
    <div className="overlay">
      <span className="participant-name">{participant.name}</span>
      {showStats && <ConnectionStats participant={participant} />}
    </div>
  );
}
```

### Pattern 3: State Management Integration

```typescript
// hooks/useLiveKitStore.ts
import { create } from 'zustand';
import { Participant, Track } from 'livekit-client';

interface LiveKitStore {
  // State
  selectedParticipant: Participant | null;
  pinnedTracks: string[];
  layoutMode: 'grid' | 'focus' | 'presenter';

  // Actions
  selectParticipant: (participant: Participant | null) => void;
  togglePin: (trackId: string) => void;
  setLayoutMode: (mode: 'grid' | 'focus' | 'presenter') => void;
}

export const useLiveKitStore = create<LiveKitStore>((set) => ({
  selectedParticipant: null,
  pinnedTracks: [],
  layoutMode: 'grid',

  selectParticipant: (participant) => set({ selectedParticipant: participant }),

  togglePin: (trackId) =>
    set((state) => ({
      pinnedTracks: state.pinnedTracks.includes(trackId)
        ? state.pinnedTracks.filter((id) => id !== trackId)
        : [...state.pinnedTracks, trackId],
    })),

  setLayoutMode: (mode) => set({ layoutMode: mode }),
}));

// Usage in component
export function CustomLayoutManager() {
  const { layoutMode, setLayoutMode } = useLiveKitStore();
  const tracks = useTracks([Track.Source.Camera]);

  // Layout rendering based on Zustand state
  // ...
}
```

---

## Best Practices

### 1. Always Use Hooks for Logic

Never try to reimplement WebRTC logic. Use LiveKit hooks for all real-time functionality.

```typescript
// ❌ Wrong
const toggleMicrophone = () => {
  // Don't try to manage track state yourself
  navigator.mediaDevices.getUserMedia({ audio: true })...
};

// ✅ Right
const { toggle } = useTrackToggle({ source: Track.Source.Microphone });
```

### 2. Maintain Accessibility

LiveKit hooks provide accessibility props. Always spread them:

```typescript
const { buttonProps } = useDisconnectButton({});
return (
  <button
    {...buttonProps} // Includes aria-label, role, etc.
    className="custom-styles"
  >
    Leave
  </button>
);
```

### 3. Handle Loading and Error States

```typescript
export function SafeVideoConference() {
  const connectionState = useConnectionState();

  if (connectionState === 'connecting') {
    return <LoadingSpinner />;
  }

  if (connectionState === 'disconnected') {
    return <ReconnectPrompt />;
  }

  return <CustomVideoLayout />;
}
```

### 4. Optimize Re-renders

Use React.memo and useMemo for expensive operations:

```typescript
const ParticipantGrid = React.memo(({ participants }) => {
  const sortedParticipants = useMemo(
    () => participants.sort((a, b) => /* custom sort */),
    [participants]
  );

  return (
    // Render grid
  );
});
```

### 5. Clean Component Separation

Separate logic from presentation:

```typescript
// Logic hook
function useMicrophoneControl() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async () => {
    setIsProcessing(true);
    await toggle();
    setIsProcessing(false);
  };

  return { handleToggle, isEnabled, isProcessing };
}

// Presentation component
function MicrophoneButton() {
  const { handleToggle, isEnabled, isProcessing } = useMicrophoneControl();

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
    >
      {/* UI */}
    </button>
  );
}
```

---

## Common Pitfalls and Solutions

### Pitfall 1: CSS Specificity Battles

**Problem**: Trying to override `.lk-*` classes

```css
.lk-control-bar {
  /* Won't work reliably */
}
```

**Solution**: Don't use LiveKit's styled components. Use hooks instead.

### Pitfall 2: Missing Audio Renderer

**Problem**: No audio when using custom layouts

**Solution**: Always include `<RoomAudioRenderer />`:

```typescript
return (
  <div>
    {/* Your custom UI */}
    <RoomAudioRenderer /> {/* Don't forget this! */}
  </div>
);
```

### Pitfall 3: State Synchronization Issues

**Problem**: Custom state getting out of sync with LiveKit

**Solution**: Always derive state from LiveKit hooks:

```typescript
// ❌ Wrong
const [isMuted, setIsMuted] = useState(false);

// ✅ Right
const { isEnabled } = useTrackToggle({ source: Track.Source.Microphone });
```

### Pitfall 4: Context Provider Missing

**Problem**: Hooks throwing errors about missing context

**Solution**: Ensure proper context wrapping:

```typescript
<LiveKitRoom>
  <RoomContext.Provider value={room}>
    <LayoutContextProvider>
      {/* Your components using hooks */}
    </LayoutContextProvider>
  </RoomContext.Provider>
</LiveKitRoom>
```

### Pitfall 5: Performance Issues with Large Rooms

**Problem**: UI lagging with many participants

**Solution**: Implement pagination and virtualization:

```typescript
const participants = useParticipants();
const visibleParticipants = useMemo(
  () => participants.slice(0, 9), // Show only first 9
  [participants],
);
```

---

## Migration Guide: From CSS Overrides to Hooks

### Step 1: Identify Components to Replace

List all LiveKit components you're trying to style:

- `<VideoConference>` → Build custom layout
- `<TrackToggle>` → Use `useTrackToggle()`
- `<ControlBar>` → Compose with individual hooks

### Step 2: Install UI Dependencies

```bash
pnpm install lucide-react  # Icons
pnpm install clsx          # Class utilities
# Or your preferred UI library
```

### Step 3: Create Hook Wrappers

For each component, create a hook wrapper:

```typescript
// hooks/useControls.ts
export function useControls() {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const camera = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });

  return { mic, camera, screen };
}
```

### Step 4: Build Custom Components

Replace LiveKit components with your own:

```typescript
// components/Controls.tsx
export function Controls() {
  const { mic, camera, screen } = useControls();

  return (
    <div className="your-design-system">
      {/* Your custom UI */}
    </div>
  );
}
```

### Step 5: Compose Your Layout

Replace `<VideoConference>` with composition:

```typescript
export function App() {
  return (
    <LiveKitRoom>
      <YourCustomLayout />
      <YourCustomControls />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
```

---

## Conclusion

The key to successfully customizing LiveKit UI is to **embrace the hooks pattern** rather than fighting with CSS. By understanding that LiveKit provides the logic while you provide the presentation, you can create completely custom video conferencing UIs that match your brand and design system perfectly.

### Key Takeaways:

1. **Never override LiveKit CSS** - Use hooks instead
2. **Compose, don't override** - Build layouts from smaller parts
3. **Hooks provide everything** - State, actions, and accessibility
4. **You own the presentation** - Complete visual freedom

### Resources:

- [LiveKit React Components Documentation](https://docs.livekit.io/reference/components/react/)
- [LiveKit Client SDK Documentation](https://docs.livekit.io/client-sdk-js/)
- [Example Applications](https://github.com/livekit/components-js/tree/main/examples)

---

## Quick Reference Card

```typescript
// Essential imports
import {
  // Hooks
  useTrackToggle,
  useTracks,
  useParticipants,
  useChat,
  useRoomContext,
  useConnectionState,

  // Layout components (keep these)
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,

  // Contexts
  LiveKitRoom,
  RoomContext,
  LayoutContextProvider,
} from '@livekit/components-react';

import { Track, Room } from 'livekit-client';

// Basic custom mic button
const { toggle, isEnabled } = useTrackToggle({
  source: Track.Source.Microphone,
});

// Get all tracks
const tracks = useTracks([Track.Source.Camera]);

// Get participants
const participants = useParticipants();

// Chat
const { send, chatMessages } = useChat();

// Connection
const state = useConnectionState();

// Room access
const room = useRoomContext();
```

Remember: **Hooks for logic, your components for UI!**
