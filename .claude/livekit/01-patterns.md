# LiveKit Implementation Patterns

**Foundation Required**: This document assumes complete understanding of `00-foundation.md`. These patterns implement the foundational principles in code.

## Connection Management Patterns

### Pattern: Exponential Backoff Reconnection

**Foundation Principle**: Network failures are normal, recovery is mandatory

```typescript
class LiveKitConnectionManager {
  private reconnectAttempts = 0;
  private readonly maxAttempts = 10;
  private readonly baseDelay = 1000;
  private readonly maxDelay = 30000;
  private reconnectTimer?: NodeJS.Timeout;

  async connectWithResilience(url: string, token: string): Promise<Room> {
    const room = new Room({
      // Critical: Configure for resilience
      reconnectPolicy: {
        nextRetryDelayInMs: (retryCount: number) => {
          return Math.min(this.baseDelay * Math.pow(2, retryCount), this.maxDelay);
        },
        maxRetries: this.maxAttempts,
      },
      // Adapt quality automatically
      dynacast: true,
      adaptiveStream: true,
    });

    try {
      await room.connect(url, token);
      this.reconnectAttempts = 0; // Reset on success
      this.setupConnectionMonitoring(room);
      return room;
    } catch (error) {
      return this.handleConnectionFailure(room, url, token, error);
    }
  }

  private setupConnectionMonitoring(room: Room) {
    // Monitor both signaling and media planes
    room.on('connectionStateChanged', (state) => {
      console.log(`Signaling state: ${state}`);
      if (state === 'reconnecting') {
        this.notifyUserOfReconnection();
      }
    });

    room.on('mediaConnectionStateChanged', (state) => {
      console.log(`Media state: ${state}`);
      // Handle media-specific issues
    });

    // Foundation: Events drive everything
    room.on('disconnected', (reason?: DisconnectReason) => {
      this.handleDisconnection(reason);
    });
  }

  private async handleConnectionFailure(
    room: Room,
    url: string,
    token: string,
    error: Error,
  ): Promise<Room> {
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxAttempts) {
      throw new Error('Max reconnection attempts exceeded');
    }

    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxDelay);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    await this.sleep(delay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    await this.sleep(jitter);

    return this.connectWithResilience(url, token);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### Pattern: Connection State Machine

**Foundation Principle**: Everything is a state machine

```typescript
enum ConnectionState {
  Idle = 'idle',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Disconnecting = 'disconnecting',
  Disconnected = 'disconnected',
  Failed = 'failed',
}

class StateManagedConnection {
  private state: ConnectionState = ConnectionState.Idle;
  private stateListeners = new Set<(state: ConnectionState) => void>();

  // State machine with allowed transitions
  private readonly transitions: Record<ConnectionState, ConnectionState[]> = {
    [ConnectionState.Idle]: [ConnectionState.Connecting],
    [ConnectionState.Connecting]: [ConnectionState.Connected, ConnectionState.Failed],
    [ConnectionState.Connected]: [ConnectionState.Reconnecting, ConnectionState.Disconnecting],
    [ConnectionState.Reconnecting]: [ConnectionState.Connected, ConnectionState.Failed],
    [ConnectionState.Disconnecting]: [ConnectionState.Disconnected],
    [ConnectionState.Disconnected]: [ConnectionState.Connecting],
    [ConnectionState.Failed]: [ConnectionState.Connecting],
  };

  private transitionTo(newState: ConnectionState): boolean {
    const allowedTransitions = this.transitions[this.state];

    if (!allowedTransitions.includes(newState)) {
      console.error(`Invalid transition: ${this.state} → ${newState}`);
      return false;
    }

    console.log(`State transition: ${this.state} → ${newState}`);
    this.state = newState;
    this.notifyStateListeners();
    return true;
  }

  async connect(room: Room, url: string, token: string) {
    if (!this.transitionTo(ConnectionState.Connecting)) {
      throw new Error(`Cannot connect from state: ${this.state}`);
    }

    try {
      await room.connect(url, token);
      this.transitionTo(ConnectionState.Connected);
    } catch (error) {
      this.transitionTo(ConnectionState.Failed);
      throw error;
    }
  }
}
```

## Track Management Patterns

### Pattern: Lifecycle-Aware Track Management

**Foundation Principle**: Every resource has a lifecycle that must be managed

```typescript
class TrackManager {
  private tracks = new Map<string, LocalTrack>();
  private subscriptions = new Map<string, RemoteTrack>();
  private cleanupCallbacks = new Map<string, () => void>();

  async acquireVideoTrack(options?: VideoCaptureOptions): Promise<LocalVideoTrack> {
    // Foundation: State machine awareness
    const trackId = this.generateTrackId('video');

    try {
      // Acquisition phase
      const track = await createLocalVideoTrack({
        ...options,
        // Implement graceful degradation
        resolution: options?.resolution || VideoPresets.h720.resolution,
      });

      // Lifecycle tracking
      this.tracks.set(trackId, track);

      // Setup cleanup callback
      this.cleanupCallbacks.set(trackId, () => {
        track.stop(); // Critical: Release hardware resources
        this.tracks.delete(trackId);
      });

      // Monitor track state
      track.on('ended', () => {
        console.log(`Track ${trackId} ended unexpectedly`);
        this.handleTrackEnded(trackId);
      });

      return track;
    } catch (error) {
      // Handle acquisition failure
      this.handleAcquisitionFailure(error, 'video');
      throw error;
    }
  }

  async publishTrack(
    participant: LocalParticipant,
    track: LocalTrack,
  ): Promise<LocalTrackPublication> {
    // Foundation: Eventual consistency
    const publication = await participant.publishTrack(track, {
      // Enable simulcast for adaptive quality
      simulcast: track.kind === 'video',
      // Configure video encoding
      videoEncoding: {
        maxBitrate: 2_000_000,
        maxFramerate: 30,
      },
      // Set priority
      priority: 'high',
    });

    // Don't assume success - verify
    publication.on('subscribed', () => {
      console.log('Track successfully subscribed by server');
    });

    return publication;
  }

  // Critical: Cleanup pattern
  async cleanup(): Promise<void> {
    // Stop all tracks
    for (const [trackId, cleanup] of this.cleanupCallbacks) {
      try {
        cleanup();
      } catch (error) {
        console.error(`Failed to cleanup track ${trackId}:`, error);
      }
    }

    this.tracks.clear();
    this.subscriptions.clear();
    this.cleanupCallbacks.clear();
  }

  // Foundation: Graceful degradation
  private async handleAcquisitionFailure(error: Error, kind: 'video' | 'audio') {
    if (kind === 'video' && error.name === 'NotFoundError') {
      // No camera available
      console.warn('No camera available, continuing audio-only');
      // Gracefully degrade to audio-only
    } else if (error.name === 'NotAllowedError') {
      // Permission denied
      console.warn('Camera permission denied');
      // Notify user and provide instructions
    } else {
      // Unknown error
      throw error;
    }
  }

  private handleTrackEnded(trackId: string) {
    // Track ended unexpectedly (user unplugged camera, etc.)
    const cleanup = this.cleanupCallbacks.get(trackId);
    if (cleanup) {
      cleanup();
      this.cleanupCallbacks.delete(trackId);
    }
  }

  private generateTrackId(kind: string): string {
    return `${kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Pattern: Safe Track Subscription

**Foundation Principle**: Events drive everything, handle all states

```typescript
class TrackSubscriptionManager {
  private remoteTrackHandlers = new Map<string, RemoteTrackHandlers>()

  interface RemoteTrackHandlers {
    onSubscribed: (track: RemoteTrack) => void
    onUnsubscribed: () => void
    cleanup: () => void
  }

  setupParticipantTrackHandlers(participant: RemoteParticipant) {
    // Foundation: Events can arrive in any order
    const handlers = {
      trackSubscribed: (track: RemoteTrack, publication: RemoteTrackPublication) => {
        this.handleTrackSubscribed(participant, track, publication)
      },
      trackUnsubscribed: (track: RemoteTrack, publication: RemoteTrackPublication) => {
        this.handleTrackUnsubscribed(participant, track, publication)
      },
      trackMuted: (publication: RemoteTrackPublication) => {
        this.handleTrackMuted(participant, publication)
      },
      trackUnmuted: (publication: RemoteTrackPublication) => {
        this.handleTrackUnmuted(participant, publication)
      },
    }

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      participant.on(event as any, handler as any)
    })

    // Store cleanup function
    const cleanup = () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        participant.off(event as any, handler as any)
      })
    }

    this.remoteTrackHandlers.set(participant.identity, { ...handlers, cleanup })
  }

  private handleTrackSubscribed(
    participant: RemoteParticipant,
    track: RemoteTrack,
    publication: RemoteTrackPublication
  ) {
    console.log(`Subscribed to ${participant.identity}'s ${track.kind} track`)

    // Foundation: State verification before use
    if (track.kind === 'video' && publication.videoTrack) {
      this.attachVideoTrack(publication.videoTrack, participant.identity)
    } else if (track.kind === 'audio' && publication.audioTrack) {
      this.attachAudioTrack(publication.audioTrack, participant.identity)
    }

    // Monitor track quality
    if (track.kind === 'video') {
      publication.on('videoQualityChanged', (quality: VideoQuality) => {
        this.handleQualityChange(participant.identity, quality)
      })
    }
  }

  private attachVideoTrack(track: RemoteVideoTrack, participantId: string) {
    // Create or get video element
    const videoElement = this.getOrCreateVideoElement(participantId)

    // Foundation: Always check state before operation
    if (track.isSubscribed && !track.isMuted) {
      track.attach(videoElement)
    }

    // Handle future state changes
    track.on('muted', () => {
      videoElement.style.visibility = 'hidden'
    })

    track.on('unmuted', () => {
      videoElement.style.visibility = 'visible'
    })
  }

  // Cleanup everything on disconnect
  cleanupAllTracks() {
    for (const [participantId, handlers] of this.remoteTrackHandlers) {
      handlers.cleanup()
    }
    this.remoteTrackHandlers.clear()
  }
}
```

## Event Handling Patterns

### Pattern: Event Queue with Priority

**Foundation Principle**: Events arrive continuously and might need ordering

```typescript
class PrioritizedEventQueue {
  private queues: Map<EventPriority, Array<QueuedEvent>> = new Map([
    [EventPriority.Critical, []],
    [EventPriority.High, []],
    [EventPriority.Normal, []],
    [EventPriority.Low, []],
  ])

  private processing = false
  private eventHandlers = new Map<string, EventHandler>()

  enum EventPriority {
    Critical = 0, // Connection state changes
    High = 1,     // Track publications
    Normal = 2,   // Participant updates
    Low = 3,      // Stats and metrics
  }

  interface QueuedEvent {
    type: string
    data: any
    timestamp: number
    priority: EventPriority
  }

  enqueue(event: QueuedEvent) {
    const queue = this.queues.get(event.priority)!
    queue.push(event)

    if (!this.processing) {
      this.processQueue()
    }
  }

  private async processQueue() {
    this.processing = true

    try {
      // Process by priority
      for (const [priority, queue] of this.queues) {
        while (queue.length > 0) {
          const event = queue.shift()!

          // Age check - discard stale events
          if (Date.now() - event.timestamp > 5000 && priority === EventPriority.Low) {
            console.log(`Discarding stale event: ${event.type}`)
            continue
          }

          await this.handleEvent(event)
        }
      }
    } finally {
      this.processing = false
    }
  }

  private async handleEvent(event: QueuedEvent) {
    const handler = this.eventHandlers.get(event.type)

    if (!handler) {
      console.warn(`No handler for event: ${event.type}`)
      return
    }

    try {
      await handler(event.data)
    } catch (error) {
      console.error(`Error handling event ${event.type}:`, error)
      // Foundation: Failures are normal, continue processing
    }
  }
}
```

### Pattern: Debounced Metadata Updates

**Foundation Principle**: Eventual consistency, batch operations

```typescript
class MetadataManager {
  private pendingUpdates = new Map<string, any>();
  private updateTimer?: NodeJS.Timeout;
  private readonly debounceMs = 500;

  updateMetadata(participant: LocalParticipant, key: string, value: any) {
    // Batch updates for efficiency
    this.pendingUpdates.set(key, value);

    // Clear existing timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    // Set new timer
    this.updateTimer = setTimeout(() => {
      this.flushMetadata(participant);
    }, this.debounceMs);
  }

  private async flushMetadata(participant: LocalParticipant) {
    if (this.pendingUpdates.size === 0) return;

    const metadata = {
      ...JSON.parse(participant.metadata || '{}'),
      ...Object.fromEntries(this.pendingUpdates),
      lastUpdated: Date.now(),
    };

    try {
      await participant.setMetadata(JSON.stringify(metadata));
      this.pendingUpdates.clear();
    } catch (error) {
      console.error('Failed to update metadata:', error);
      // Retry with exponential backoff
      setTimeout(() => this.flushMetadata(participant), 1000);
    }
  }
}
```

## State Synchronization Patterns

### Pattern: Optimistic Updates with Rollback

**Foundation Principle**: Eventual consistency with local prediction

```typescript
class OptimisticStateManager {
  private confirmedState: Map<string, any> = new Map()
  private optimisticState: Map<string, any> = new Map()
  private pendingOperations: Map<string, PendingOperation> = new Map()

  interface PendingOperation {
    id: string
    type: 'add' | 'update' | 'delete'
    key: string
    value: any
    timestamp: number
    timeout: NodeJS.Timeout
  }

  applyOptimisticUpdate(key: string, value: any): string {
    const operationId = this.generateOperationId()

    // Apply optimistically
    this.optimisticState.set(key, value)

    // Track pending operation
    const timeout = setTimeout(() => {
      this.rollbackOperation(operationId)
    }, 5000) // Rollback if not confirmed within 5s

    this.pendingOperations.set(operationId, {
      id: operationId,
      type: 'update',
      key,
      value,
      timestamp: Date.now(),
      timeout,
    })

    // Notify UI of optimistic update
    this.notifyStateChange(key, value, 'optimistic')

    return operationId
  }

  confirmOperation(operationId: string) {
    const operation = this.pendingOperations.get(operationId)
    if (!operation) return

    // Move to confirmed state
    this.confirmedState.set(operation.key, operation.value)
    this.pendingOperations.delete(operationId)
    clearTimeout(operation.timeout)

    // Notify UI of confirmed update
    this.notifyStateChange(operation.key, operation.value, 'confirmed')
  }

  rollbackOperation(operationId: string) {
    const operation = this.pendingOperations.get(operationId)
    if (!operation) return

    // Restore previous state
    const previousValue = this.confirmedState.get(operation.key)
    this.optimisticState.set(operation.key, previousValue)
    this.pendingOperations.delete(operationId)

    // Notify UI of rollback
    this.notifyStateChange(operation.key, previousValue, 'rollback')
  }

  private notifyStateChange(key: string, value: any, type: 'optimistic' | 'confirmed' | 'rollback') {
    // Emit event for UI updates
    console.log(`State change [${type}]: ${key} = ${JSON.stringify(value)}`)
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
```

## Quality Adaptation Patterns

### Pattern: Bandwidth-Aware Quality Management

**Foundation Principle**: Graceful degradation based on network conditions

```typescript
class QualityManager {
  private currentQuality: VideoQuality = VideoQuality.HIGH;
  private qualityHistory: Array<{ quality: ConnectionQuality; timestamp: number }> = [];
  private readonly historyWindow = 10000; // 10 seconds

  setupQualityAdaptation(room: Room) {
    room.on('connectionQualityChanged', (quality: ConnectionQuality) => {
      this.handleQualityChange(room, quality);
    });

    // Monitor local participant specifically
    room.localParticipant.on('connectionQualityChanged', (quality: ConnectionQuality) => {
      this.adaptLocalQuality(room.localParticipant, quality);
    });
  }

  private handleQualityChange(room: Room, quality: ConnectionQuality) {
    // Track quality history
    this.qualityHistory.push({
      quality,
      timestamp: Date.now(),
    });

    // Clean old history
    const cutoff = Date.now() - this.historyWindow;
    this.qualityHistory = this.qualityHistory.filter((h) => h.timestamp > cutoff);

    // Calculate average quality
    const averageQuality = this.calculateAverageQuality();

    // Make adaptation decision
    if (averageQuality <= ConnectionQuality.Poor) {
      this.degradeQuality(room);
    } else if (
      averageQuality >= ConnectionQuality.Good &&
      this.currentQuality !== VideoQuality.HIGH
    ) {
      this.improveQuality(room);
    }
  }

  private async degradeQuality(room: Room) {
    console.log('Degrading quality due to poor connection');

    // Disable video for poor connections
    if (this.currentQuality === VideoQuality.HIGH) {
      this.currentQuality = VideoQuality.MEDIUM;
      await this.setVideoQuality(room, VideoQuality.MEDIUM);
    } else if (this.currentQuality === VideoQuality.MEDIUM) {
      this.currentQuality = VideoQuality.LOW;
      await this.setVideoQuality(room, VideoQuality.LOW);
    } else {
      // Audio only mode
      await this.disableVideo(room);
    }
  }

  private async improveQuality(room: Room) {
    console.log('Improving quality due to good connection');

    if (this.currentQuality === VideoQuality.LOW) {
      this.currentQuality = VideoQuality.MEDIUM;
      await this.setVideoQuality(room, VideoQuality.MEDIUM);
    } else if (this.currentQuality === VideoQuality.MEDIUM) {
      this.currentQuality = VideoQuality.HIGH;
      await this.setVideoQuality(room, VideoQuality.HIGH);
    }
  }

  private async setVideoQuality(room: Room, quality: VideoQuality) {
    const videoTrack = room.localParticipant.videoTracks.values().next().value;

    if (videoTrack?.track) {
      await (videoTrack.track as LocalVideoTrack).setVideoQuality(quality);
    }
  }

  private async disableVideo(room: Room) {
    const videoTrack = room.localParticipant.videoTracks.values().next().value;

    if (videoTrack?.track) {
      await room.localParticipant.unpublishTrack(videoTrack.track);
    }
  }

  private calculateAverageQuality(): ConnectionQuality {
    if (this.qualityHistory.length === 0) return ConnectionQuality.Good;

    const sum = this.qualityHistory.reduce((acc, h) => acc + h.quality, 0);
    return Math.round(sum / this.qualityHistory.length) as ConnectionQuality;
  }
}
```

## Data Channel Patterns

### Pattern: Reliable Message Delivery

**Foundation Principle**: Handle partial failures and message ordering

```typescript
class ReliableDataChannel {
  private messageQueue: Array<QueuedMessage> = []
  private acknowledgments = new Map<string, NodeJS.Timeout>()
  private readonly maxRetries = 3
  private readonly ackTimeout = 3000

  interface QueuedMessage {
    id: string
    payload: any
    retries: number
    timestamp: number
  }

  async sendReliableMessage(
    participant: LocalParticipant,
    data: any,
    recipients?: string[]
  ): Promise<void> {
    const message: QueuedMessage = {
      id: this.generateMessageId(),
      payload: {
        ...data,
        _messageId: this.generateMessageId(),
        _timestamp: Date.now(),
      },
      retries: 0,
      timestamp: Date.now(),
    }

    this.messageQueue.push(message)
    await this.attemptSend(participant, message, recipients)
  }

  private async attemptSend(
    participant: LocalParticipant,
    message: QueuedMessage,
    recipients?: string[]
  ): Promise<void> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(JSON.stringify(message.payload))

      await participant.publishData(data, DataPacket_Kind.RELIABLE, recipients)

      // Set acknowledgment timeout
      const timeout = setTimeout(() => {
        this.handleNoAcknowledgment(participant, message, recipients)
      }, this.ackTimeout)

      this.acknowledgments.set(message.id, timeout)
    } catch (error) {
      console.error('Failed to send message:', error)
      this.handleSendFailure(participant, message, recipients)
    }
  }

  private handleNoAcknowledgment(
    participant: LocalParticipant,
    message: QueuedMessage,
    recipients?: string[]
  ) {
    message.retries++

    if (message.retries < this.maxRetries) {
      console.log(`Retrying message ${message.id} (attempt ${message.retries + 1})`)
      this.attemptSend(participant, message, recipients)
    } else {
      console.error(`Message ${message.id} failed after ${this.maxRetries} attempts`)
      this.messageQueue = this.messageQueue.filter(m => m.id !== message.id)
    }
  }

  receiveAcknowledgment(messageId: string) {
    const timeout = this.acknowledgments.get(messageId)
    if (timeout) {
      clearTimeout(timeout)
      this.acknowledgments.delete(messageId)
      this.messageQueue = this.messageQueue.filter(m => m.id !== messageId)
    }
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
```

## Complete Implementation Example

### Pattern: Full Room Manager

Combining all patterns into a cohesive implementation:

```typescript
class CompleteRoomManager {
  private room?: Room;
  private connectionManager: LiveKitConnectionManager;
  private trackManager: TrackManager;
  private qualityManager: QualityManager;
  private metadataManager: MetadataManager;
  private dataChannel: ReliableDataChannel;
  private eventQueue: PrioritizedEventQueue;

  constructor() {
    this.connectionManager = new LiveKitConnectionManager();
    this.trackManager = new TrackManager();
    this.qualityManager = new QualityManager();
    this.metadataManager = new MetadataManager();
    this.dataChannel = new ReliableDataChannel();
    this.eventQueue = new PrioritizedEventQueue();
  }

  async joinRoom(url: string, token: string): Promise<void> {
    try {
      // Foundation: Connection with resilience
      this.room = await this.connectionManager.connectWithResilience(url, token);

      // Setup all subsystems
      this.setupEventHandlers();
      this.qualityManager.setupQualityAdaptation(this.room);

      // Publish local tracks
      await this.publishLocalTracks();

      // Handle existing participants
      this.room.participants.forEach((participant) => {
        this.handleParticipantConnected(participant);
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  private setupEventHandlers() {
    if (!this.room) return;

    // Foundation: Events drive everything
    this.room.on('participantConnected', (participant) => {
      this.eventQueue.enqueue({
        type: 'participantConnected',
        data: participant,
        timestamp: Date.now(),
        priority: EventPriority.High,
      });
    });

    this.room.on('trackPublished', (publication, participant) => {
      this.eventQueue.enqueue({
        type: 'trackPublished',
        data: { publication, participant },
        timestamp: Date.now(),
        priority: EventPriority.High,
      });
    });

    // ... more event handlers
  }

  async disconnect(): Promise<void> {
    // Foundation: Cleanup is mandatory
    await this.trackManager.cleanup();
    this.room?.disconnect();
    this.room = undefined;
  }
}
```

## Summary

These patterns implement the LiveKit foundation by:

1. **Treating everything as state machines** with defined transitions
2. **Building event-driven architectures** that react to continuous streams
3. **Assuming eventual consistency** and handling it gracefully
4. **Designing for failure** with automatic recovery
5. **Managing lifecycles** explicitly for all resources
6. **Degrading gracefully** based on conditions
7. **Prioritizing recovery** over initial connection

Each pattern directly maps to foundational principles and provides production-ready implementation strategies.
