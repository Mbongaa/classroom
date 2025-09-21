# LiveKit Foundation: The Mental Model

**CRITICAL**: This document establishes the fundamental mental model for LiveKit. Every pattern, implementation, and decision must align with these foundational principles. LiveKit is NOT a traditional web framework - it operates on entirely different architectural principles.

## ⚠️ MANDATORY: Documentation Verification Before Implementation

**NEVER TRUST MEMORY - ALWAYS VERIFY WITH CURRENT DOCUMENTATION**

Before implementing ANY LiveKit feature, you MUST:

1. **Check Current Version**

   ```bash
   # Check package.json for exact versions
   cat package.json | grep -E '"livekit-client"|"@livekit/components-react"'
   ```

2. **Fetch Current Documentation via Context7**

   ```typescript
   // REQUIRED: Use Context7 to get current docs
   const docs = await context7.getLibraryDocs({
     library: 'livekit-client',
     version: '<current-version-from-package.json>',
     topic: '<specific-feature-you-are-implementing>',
   });
   ```

3. **Verify API Exists and Signature Matches**
   - Confirm the method/property exists in current version
   - Check exact parameter types and order
   - Verify return types match expectations
   - Look for deprecation warnings

4. **Check for Breaking Changes**
   - Review migration guides if version changed
   - Check changelog for the specific version range
   - Verify event names haven't changed

5. **Review Official Examples**
   - Look for official LiveKit examples for the pattern
   - Check if there's a recommended approach
   - Verify you're not using outdated patterns

**Why This Matters**:

- LiveKit APIs evolve rapidly
- Method signatures change between versions
- New features often provide better solutions
- Deprecated patterns can cause subtle bugs
- Official docs contain critical performance tips

**RED FLAGS - Stop if you encounter these**:

- "I think the method is called..."
- "It should work like this..."
- "From what I remember..."
- "This is probably the right way..."

**CORRECT Approach**:

- "According to the current LiveKit v2.x.x docs..."
- "The Context7 documentation confirms..."
- "The official example shows..."
- "After checking the current API reference..."

## Core Reality: Everything is a State Machine

### The State Machine Universe

In LiveKit, every single component exists as a state machine with defined transitions:

```
Room States:
disconnected → connecting → connected → reconnecting → disconnecting → disconnected
     ↑            ↓            ↓            ↓              ↓
     └────────────┴────────────┴────────────┴──────────────┘

Track States:
uninitialized → acquiring → acquired → publishing → published → stopping → stopped
      ↑             ↓           ↓           ↓            ↓          ↓
      └─────────────┴───────────┴───────────┴────────────┴──────────┘

Participant States:
unknown → joining → active → reconnecting → leaving → disconnected
    ↑        ↓         ↓          ↓            ↓
    └────────┴─────────┴──────────┴────────────┘
```

**Key Principle**: Your code MUST handle ALL states, not just the happy path. A track might be "acquiring" when you try to publish it. A room might be "reconnecting" when you send data. Design for every state.

### State Transition Rules

1. **Transitions are asynchronous and non-instant**
2. **States can regress** (connected → reconnecting → connected)
3. **Multiple components have interdependent states** (can't publish track if room isn't connected)
4. **State queries reflect the past**, not the guaranteed present

## Events Drive Everything

### The Event-Driven Reality

Traditional Web Development:

```
User Action → Update State → Re-render UI → Wait for next action
```

LiveKit Reality:

```
Continuous Event Stream ←→ State Machine Updates ←→ UI Reflects State
         ↑                           ↑                        ↑
    Network Events            Internal Events          User Actions
```

### Critical Event Principles

1. **Events arrive continuously**, not on request
2. **Event order is not guaranteed** across different sources
3. **Events are the single source of truth** - UI must derive from events
4. **Missing an event means state desynchronization**

### Event Categories

**Room Events**: Connection state changes, participant updates, data messages

```typescript
// These can fire at ANY time, not just after your actions
room.on('connected', () => {});
room.on('participantConnected', () => {});
room.on('trackPublished', () => {});
```

**Track Events**: Media state changes, quality updates, errors

```typescript
// Track events cascade - one track error might trigger multiple events
track.on('ended', () => {}); // User stopped sharing
track.on('muted', () => {}); // Temporary mute
track.on('unmuted', () => {}); // Can happen automatically
```

**Participant Events**: Metadata updates, track publications, connection quality

```typescript
// Participant events reflect distributed state
participant.on('trackSubscribed', () => {});
participant.on('connectionQualityChanged', () => {});
```

## Distributed System Principles

### Eventual Consistency is the Only Consistency

When you perform an action in LiveKit, it follows this pattern:

```
Local Action → Optimistic Update → Server Processing → Propagation → Confirmation Event
     (0ms)         (1-10ms)          (10-50ms)         (20-200ms)      (50-500ms)
```

**Example**: Publishing a track

1. You call `localParticipant.publishTrack()`
2. Local state updates optimistically
3. Server receives publish request
4. Server notifies other participants
5. You receive confirmation via `trackPublished` event
6. Other participants receive `trackPublished` event (at different times!)

### Network Failures are Normal

LiveKit operates under the assumption that:

- **Connections WILL drop** (not might)
- **Packets WILL be lost** (WebRTC handles some, you handle the rest)
- **Quality WILL degrade** (design for it)
- **Devices WILL fail** (cameras disconnect, permissions revoked)

Your code must:

```typescript
// WRONG: Assuming success
await room.connect(url, token);
publishTrack(track);

// RIGHT: Handling reality
try {
  await room.connect(url, token);
  // Still need to check if connected!
  if (room.state === 'connected') {
    try {
      await publishTrack(track);
      // Still might fail or partially succeed!
    } catch (publishError) {
      // Handle track publication failure
      // Room might still be connected!
    }
  }
} catch (connectionError) {
  // Handle connection failure
  // Implement retry strategy
}
```

## The Dual-Plane Architecture

### Signaling Plane vs Media Plane

LiveKit operates on two separate communication channels:

**Signaling Plane** (WebSocket):

- Room state management
- Participant updates
- Track negotiation
- Data messages
- Quality adaptation commands

**Media Plane** (WebRTC):

- Actual audio/video data
- Screen share streams
- Low-latency transmission
- Peer-to-peer when possible
- Server-routed for quality/recording

### Why This Matters

The planes can fail independently:

- Signaling connected but media blocked (firewall issues)
- Media flowing but signaling disconnected (state updates stop)
- One recovers while other remains broken

Your error handling must account for both:

```typescript
// Monitor both planes
room.on('connectionStateChanged', (state) => {
  // Signaling state
});

room.on('mediaConnectionStateChanged', (state) => {
  // Media state
});
```

## Fundamental Operational Patterns

### Pattern 1: Lifecycle Management

Every LiveKit resource has a lifecycle that MUST be managed:

```typescript
// Acquisition → Usage → Cleanup
const track = await createLocalVideoTrack(); // Acquire
await localParticipant.publishTrack(track); // Use
// ...later...
track.stop(); // Cleanup (MANDATORY)
localParticipant.unpublishTrack(track); // More cleanup
```

### Pattern 2: Graceful Degradation

Quality of Experience > Feature Completeness:

```typescript
// Start high, degrade gracefully
const qualities = ['1080p', '720p', '360p', 'audio-only', 'disconnected'];

// System automatically degrades, you must handle it
room.on('connectionQualityChanged', (quality) => {
  adaptUIToQuality(quality);
});
```

### Pattern 3: Recovery-First Design

Always design for recovery, not just connection:

```typescript
class RoomConnection {
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  async connect() {
    try {
      await this.room.connect(url, token);
    } catch (error) {
      await this.handleConnectionFailure(error);
    }
  }

  private async handleConnectionFailure(error: Error) {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);

    this.reconnectAttempts++;
    await sleep(delay);

    // Retry with exponential backoff
    return this.connect();
  }
}
```

## Critical Success Factors

### What Success Looks Like

1. **Your application remains functional** during connection interruptions
2. **UI accurately reflects state** even during transitions
3. **Resources are cleaned up** preventing memory leaks
4. **Failed operations recover automatically** without user intervention
5. **Quality adapts smoothly** to network conditions

### What Failure Looks Like

1. Application crashes when connection drops
2. UI shows wrong state (shows video when track stopped)
3. Memory leaks from uncleaned tracks/listeners
4. Users must refresh page to recover from errors
5. Poor quality experience instead of degraded features

## The LiveKit Mindset

When implementing ANY LiveKit feature, ask yourself:

1. **What states can each component be in?**
2. **What events will fire and when?**
3. **How long until consistency is achieved?**
4. **What fails independently?**
5. **How does this degrade gracefully?**
6. **What cleanup is required?**

If you cannot answer ALL these questions, you are not ready to implement the feature.

## Summary: The Mental Model

LiveKit is a distributed, event-driven, real-time system where:

- Everything is a state machine that must be managed
- Events drive all behavior and arrive continuously
- Consistency is eventual, not immediate
- Network failures are normal operations
- Two independent planes must be coordinated
- Every resource requires lifecycle management
- Quality degrades gracefully by design
- Recovery is more important than connection

**This is your foundation. Every pattern, every implementation, every decision must align with these principles.**
