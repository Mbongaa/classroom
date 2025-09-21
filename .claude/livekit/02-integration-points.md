# LiveKit Integration Points

**Critical**: This document defines how LiveKit's real-time, event-driven architecture integrates with traditional web application patterns. These are the boundaries where different mental models meet.

## Authentication Integration

### The Token Boundary

LiveKit uses JWT tokens for authentication. This is the critical handoff point between your application's auth system and LiveKit's distributed system.

**Application Domain** → **Token Generation** → **LiveKit Domain**

```typescript
// ===== APPLICATION DOMAIN (Server-Side) =====
// This runs in your Next.js API route or server action
// NEVER expose this to client code

import { AccessToken } from 'livekit-server-sdk';

// /app/api/connection-details/route.ts
export async function POST(request: Request) {
  // APPLICATION AUTH: Verify user identity
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // APPLICATION LOGIC: Determine permissions
  const { roomName, role = 'participant' } = await request.json();

  // Check if user can access this room (your business logic)
  const canAccess = await checkRoomAccess(session.user.id, roomName);
  if (!canAccess) {
    return new Response('Forbidden', { status: 403 });
  }

  // ===== BOUNDARY: Generate LiveKit Token =====
  const token = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: session.user.id, // Map your user ID
    name: session.user.name, // Display name in LiveKit
    metadata: JSON.stringify({
      // Pass application context to LiveKit
      email: session.user.email,
      role: role,
      joinedAt: Date.now(),
    }),
  });

  // LIVEKIT PERMISSIONS: Based on your role logic
  if (role === 'teacher') {
    token.addGrant({
      room: roomName,
      roomJoin: true,
      roomAdmin: true, // Can kick/mute others
      roomRecord: true, // Can start recording
      canPublish: true, // Can share video/audio
      canSubscribe: true, // Can see others
      canPublishData: true, // Can send messages
    });
  } else if (role === 'student') {
    token.addGrant({
      room: roomName,
      roomJoin: true,
      roomAdmin: false, // Cannot moderate
      roomRecord: false, // Cannot record
      canPublish: false, // Listen-only by default
      canSubscribe: true, // Can see others
      canPublishData: true, // Can chat
    });
  }

  const jwt = token.toJwt();

  // Return to client for LiveKit connection
  return Response.json({
    token: jwt,
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  });
}

// ===== CLIENT DOMAIN (Browser) =====
// This runs in your React component

async function connectToRoom() {
  // Get token from your backend
  const response = await fetch('/api/connection-details', {
    method: 'POST',
    body: JSON.stringify({ roomName, role }),
  });

  const { token, url } = await response.json();

  // ===== ENTER LIVEKIT DOMAIN =====
  const room = new Room();
  await room.connect(url, token);
  // Now operating in LiveKit's event-driven world
}
```

### Critical Integration Rules

1. **Token generation is ALWAYS server-side** (never expose API secret)
2. **User identity mapping happens at token generation** (not in LiveKit)
3. **Permissions are immutable once token is issued** (can't change mid-session)
4. **Token expiry should align with your session management**

## Next.js Integration

### The Component Boundary

LiveKit operates in client components only. This is a hard architectural boundary.

```typescript
// ===== SERVER COMPONENT (Can't use LiveKit) =====
// app/rooms/[roomName]/page.tsx

export default async function RoomPage({ params }: { params: { roomName: string } }) {
  // Server-side operations only
  const roomData = await getRoomData(params.roomName) // Database query

  // Pass to client component
  return (
    <RoomClientComponent
      roomName={params.roomName}
      roomData={roomData}
    />
  )
}

// ===== CLIENT COMPONENT (LiveKit lives here) =====
// app/rooms/[roomName]/RoomClientComponent.tsx
'use client' // MANDATORY for LiveKit

import { LiveKitRoom, VideoConference } from '@livekit/components-react'

export default function RoomClientComponent({ roomName, roomData }) {
  const [token, setToken] = useState<string>()

  useEffect(() => {
    // Fetch token on client
    fetchToken(roomName).then(setToken)
  }, [roomName])

  if (!token) return <div>Loading...</div>

  // LiveKit component tree starts here
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      options={{
        // LiveKit-specific configuration
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      }}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
```

### Next.js Routing Considerations

```typescript
// ===== Dynamic Routes with LiveKit =====
// Handle route changes carefully

export function RoomContainer() {
  const router = useRouter();
  const room = useRoom(); // LiveKit hook

  // Critical: Cleanup on route change
  useEffect(() => {
    const handleRouteChange = () => {
      // Disconnect from LiveKit before navigation
      room?.disconnect();
    };

    router.events?.on('routeChangeStart', handleRouteChange);

    return () => {
      router.events?.off('routeChangeStart', handleRouteChange);
      // Cleanup on unmount
      room?.disconnect();
    };
  }, [room, router]);
}
```

## State Management Integration

### The State Synchronization Boundary

Your app state and LiveKit state are separate systems that need coordination.

```typescript
// ===== Application State Manager =====
// Using Zustand/Redux/Context for app state

interface AppState {
  // Application state
  user: User
  settings: Settings

  // LiveKit bridge state
  roomState: 'idle' | 'connecting' | 'connected' | 'error'
  participants: ParticipantInfo[]
  isMuted: boolean
  isVideoEnabled: boolean
}

// ===== LiveKit State Bridge =====
// Synchronize LiveKit events to app state

function LiveKitStateBridge() {
  const room = useRoom()
  const { setRoomState, setParticipants, setIsMuted } = useAppState()

  // Bridge LiveKit events to app state
  useEffect(() => {
    if (!room) return

    const handleRoomStateChange = (state: ConnectionState) => {
      // Map LiveKit state to app state
      const appState = mapConnectionState(state)
      setRoomState(appState)
    }

    const handleParticipantsChange = () => {
      // Convert LiveKit participants to app format
      const participants = Array.from(room.participants.values()).map(p => ({
        id: p.identity,
        name: p.name || 'Unknown',
        isSpeaking: p.isSpeaking,
        isMuted: p.audioTracks.size === 0,
        metadata: JSON.parse(p.metadata || '{}')
      }))
      setParticipants(participants)
    }

    // Register bridge handlers
    room.on('connectionStateChanged', handleRoomStateChange)
    room.on('participantConnected', handleParticipantsChange)
    room.on('participantDisconnected', handleParticipantsChange)
    room.on('trackMuted', handleParticipantsChange)
    room.on('trackUnmuted', handleParticipantsChange)

    // Initial sync
    handleRoomStateChange(room.state)
    handleParticipantsChange()

    return () => {
      // Cleanup bridge handlers
      room.off('connectionStateChanged', handleRoomStateChange)
      room.off('participantConnected', handleParticipantsChange)
      room.off('participantDisconnected', handleParticipantsChange)
    }
  }, [room, setRoomState, setParticipants])

  return null // Bridge component has no UI
}

// ===== Usage in Components =====
function ParticipantList() {
  // Use app state, not LiveKit directly
  const participants = useAppState(state => state.participants)

  return (
    <ul>
      {participants.map(p => (
        <li key={p.id}>
          {p.name} {p.isSpeaking ? '🗣️' : ''}
        </li>
      ))}
    </ul>
  )
}
```

### State Synchronization Patterns

```typescript
// ===== Pattern: Optimistic UI Updates =====
function MuteButton() {
  const room = useRoom()
  const [isMuted, setIsMuted] = useAppState(state => [
    state.isMuted,
    state.setIsMuted
  ])
  const [isPending, setIsPending] = useState(false)

  const handleToggleMute = async () => {
    const newMutedState = !isMuted

    // Optimistic update
    setIsMuted(newMutedState)
    setIsPending(true)

    try {
      // Apply to LiveKit
      await room.localParticipant.setMicrophoneEnabled(!newMutedState)
      // Success - state already updated
    } catch (error) {
      // Rollback on failure
      setIsMuted(!newMutedState)
      console.error('Failed to toggle mute:', error)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button onClick={handleToggleMute} disabled={isPending}>
      {isMuted ? 'Unmute' : 'Mute'}
    </button>
  )
}
```

## Error Boundary Integration

### The Failure Isolation Boundary

LiveKit failures should not crash your entire application.

```typescript
// ===== LiveKit Error Boundary =====
class LiveKitErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    // LiveKit errors should be contained
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    console.error('LiveKit Error:', error, errorInfo)

    // Check if it's a LiveKit-specific error
    if (this.isLiveKitError(error)) {
      // Handle LiveKit errors specifically
      this.handleLiveKitError(error)
    }
  }

  private isLiveKitError(error: Error): boolean {
    return error.message.includes('LiveKit') ||
           error.message.includes('WebRTC') ||
           error.stack?.includes('@livekit/components-react')
  }

  private handleLiveKitError(error: Error) {
    // Specific handling for LiveKit errors
    if (error.message.includes('Permission denied')) {
      // Camera/mic permission issue
      this.notifyUserOfPermissionIssue()
    } else if (error.message.includes('Connection failed')) {
      // Network issue
      this.suggestNetworkTroubleshooting()
    }
  }

  render() {
    if (this.state.hasError) {
      return <this.props.fallback error={this.state.error!} />
    }

    return this.props.children
  }
}

// ===== Usage =====
function RoomPage() {
  return (
    <LiveKitErrorBoundary fallback={LiveKitErrorFallback}>
      <LiveKitRoom {...props}>
        <VideoConference />
      </LiveKitRoom>
    </LiveKitErrorBoundary>
  )
}

function LiveKitErrorFallback({ error }: { error: Error }) {
  return (
    <div className="error-container">
      <h2>Video Conference Unavailable</h2>
      <p>The video conference system encountered an error.</p>
      <details>
        <summary>Technical Details</summary>
        <pre>{error.message}</pre>
      </details>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  )
}
```

## Data Persistence Integration

### The Ephemeral vs Persistent Boundary

LiveKit data is ephemeral. Your application decides what to persist.

```typescript
// ===== Recording Integration =====
interface RecordingIntegration {
  // Ephemeral: LiveKit recording state
  isRecording: boolean;
  activeRecordingId?: string;

  // Persistent: Your database
  savedRecordings: Recording[];
}

class RecordingManager {
  // Start recording (LiveKit domain)
  async startRecording(room: Room): Promise<string> {
    // Call your backend to start recording
    const response = await fetch('/api/recordings/start', {
      method: 'POST',
      body: JSON.stringify({
        roomName: room.name,
        roomSid: room.sid,
      }),
    });

    const { recordingId } = await response.json();

    // Store recording metadata in your database
    await this.saveRecordingMetadata({
      id: recordingId,
      roomName: room.name,
      startedAt: new Date(),
      participants: Array.from(room.participants.keys()),
    });

    return recordingId;
  }

  // Stop recording and persist
  async stopRecording(recordingId: string): Promise<void> {
    // Stop LiveKit recording
    await fetch('/api/recordings/stop', {
      method: 'POST',
      body: JSON.stringify({ recordingId }),
    });

    // Update database with final state
    await this.updateRecordingMetadata(recordingId, {
      endedAt: new Date(),
      status: 'processing',
    });
  }
}

// ===== Chat Message Persistence =====
class ChatPersistence {
  // LiveKit data messages are ephemeral
  // Decide what to persist

  async handleDataMessage(message: Uint8Array, participant: Participant): Promise<void> {
    const decoded = JSON.parse(new TextDecoder().decode(message));

    // Ephemeral: Show in UI immediately
    this.displayMessage(decoded);

    // Persistent: Save important messages
    if (this.shouldPersist(decoded)) {
      await this.saveToDatabase({
        roomName: participant.room?.name,
        senderId: participant.identity,
        senderName: participant.name,
        message: decoded.content,
        timestamp: new Date(),
        type: decoded.type,
      });
    }
  }

  private shouldPersist(message: any): boolean {
    // Your business logic for what to save
    return message.type === 'important' || message.type === 'announcement' || message.isPinned;
  }
}
```

## WebRTC Statistics Integration

### The Metrics Collection Boundary

```typescript
// ===== Metrics Bridge =====
class MetricsCollector {
  private metricsHistory: MetricSnapshot[] = [];

  collectRoomMetrics(room: Room) {
    // Collect LiveKit metrics
    room.on('connectionQualityChanged', (quality, participant) => {
      this.recordMetric({
        type: 'connectionQuality',
        participantId: participant.identity,
        value: quality,
        timestamp: Date.now(),
      });
    });

    // Periodic stats collection
    setInterval(async () => {
      const stats = await this.gatherWebRTCStats(room);

      // Send to your analytics
      await this.sendToAnalytics({
        roomSid: room.sid,
        participantCount: room.participants.size,
        stats: stats,
      });
    }, 10000); // Every 10 seconds
  }

  private async gatherWebRTCStats(room: Room): Promise<any> {
    const stats = {
      bandwidth: { upload: 0, download: 0 },
      packets: { sent: 0, received: 0, lost: 0 },
      latency: 0,
    };

    // Gather from local participant
    for (const track of room.localParticipant.tracks.values()) {
      if (track.track) {
        const trackStats = await track.track.getRTCStats();
        // Process WebRTC stats...
      }
    }

    return stats;
  }
}
```

## Environment Configuration

### The Configuration Boundary

```typescript
// ===== Environment Variables =====
// .env.local (Next.js)

// Server-side only (for token generation)
LIVEKIT_API_KEY=your-api-key        # Never expose to client
LIVEKIT_API_SECRET=your-api-secret  # Never expose to client

// Client-side accessible
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud

// Optional configurations
LIVEKIT_WEBHOOK_SECRET=your-webhook-secret  # For webhook validation
S3_BUCKET=your-recordings-bucket           # For recording storage

// ===== Runtime Configuration =====
// Adapt LiveKit behavior based on environment

function getLiveKitConfig() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    // Production: Optimize for quality
    // Development: Optimize for debugging
    logLevel: isProduction ? 'warn' : 'debug',

    // Connection settings
    reconnectPolicy: {
      maxRetries: isProduction ? 10 : 3,
      nextRetryDelayInMs: (attempt) => {
        const baseDelay = isProduction ? 2000 : 500
        return Math.min(baseDelay * Math.pow(2, attempt), 30000)
      }
    },

    // Quality settings
    videoCaptureDefaults: {
      resolution: isProduction
        ? VideoPresets.h720.resolution
        : VideoPresets.h540.resolution
    },

    // Feature flags
    adaptiveStream: isProduction,
    dynacast: isProduction,
    simulcast: isProduction
  }
}
```

## Critical Integration Guidelines

### Do's ✅

1. **Keep LiveKit in client components only**
2. **Generate tokens server-side only**
3. **Bridge events to app state, don't use LiveKit state directly**
4. **Isolate LiveKit failures with error boundaries**
5. **Clean up LiveKit resources on route changes**
6. **Persist only what your business requires**
7. **Map user identities at token generation**

### Don'ts ❌

1. **Don't use LiveKit in server components**
2. **Don't expose API secrets to client**
3. **Don't assume immediate state consistency**
4. **Don't let LiveKit errors crash your app**
5. **Don't forget cleanup on unmount**
6. **Don't persist ephemeral LiveKit state**
7. **Don't modify LiveKit permissions after token generation**

## Summary

Integration points are the boundaries where LiveKit's real-time, event-driven architecture meets your application's traditional patterns. Success requires:

- Clear separation of concerns (server vs client)
- Proper state synchronization strategies
- Robust error isolation
- Careful lifecycle management
- Thoughtful persistence decisions

These boundaries are where most LiveKit integration issues occur. Respect them.
