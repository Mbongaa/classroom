# LiveKit Troubleshooting Guide

**Critical**: Most LiveKit issues stem from misunderstanding the foundational principles. Always check against `00-foundation.md` first.

## Diagnostic Decision Tree

```
Connection Issue?
├─ Token Problem? → Check Token Generation
├─ Network Issue? → Check Firewall/NAT
├─ CORS Issue? → Check Server Configuration
└─ State Issue? → Check Event Handlers

Track Issue?
├─ Permission Denied? → Check Browser Permissions
├─ Not Publishing? → Check Room State
├─ Not Visible? → Check Subscription State
└─ Poor Quality? → Check Network/Bandwidth

State Issue?
├─ Out of Sync? → Check Event Registration
├─ Missing Updates? → Check Event Order
├─ Stale Data? → Check Cleanup
└─ Race Condition? → Check Async Handling
```

## Connection Issues

### Issue: "Connection Failed" or "Unable to Connect"

**Symptoms**: Room.connect() fails or times out

**Diagnostic Steps**:

```typescript
// 1. Verify Token Structure
function debugToken(token: string) {
  try {
    // Decode without verification (for debugging only!)
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));

    console.log('Token Claims:', {
      identity: payload.sub,
      room: payload.video?.room,
      permissions: payload.video,
      expiry: new Date(payload.exp * 1000),
      isExpired: payload.exp * 1000 < Date.now(),
    });

    // Check for common issues
    if (payload.exp * 1000 < Date.now()) {
      console.error('TOKEN EXPIRED');
    }
    if (!payload.video?.roomJoin) {
      console.error('NO ROOM JOIN PERMISSION');
    }
  } catch (e) {
    console.error('INVALID TOKEN FORMAT');
  }
}

// 2. Test Network Connectivity
async function testConnectivity() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

  // Test WebSocket connectivity
  const ws = new WebSocket(url.replace('wss://', 'https://'));

  ws.onopen = () => console.log('WebSocket: Connected');
  ws.onerror = (e) => console.error('WebSocket: Failed', e);

  // Test HTTPS endpoint
  try {
    const response = await fetch(url.replace('wss://', 'https://'));
    console.log('HTTPS Test:', response.status);
  } catch (e) {
    console.error('HTTPS Failed:', e);
  }
}

// 3. Enable Verbose Logging
const room = new Room({
  logLevel: LogLevel.debug,
  loggerName: 'LiveKit',
});

// Monitor connection state changes
room.on('connectionStateChanged', (state) => {
  console.log(`Connection State: ${state}`);
});

room.on('signalConnected', () => {
  console.log('Signal Connected (WebSocket OK)');
});

room.on('mediaDevicesError', (e) => {
  console.error('Media Device Error:', e);
});
```

**Common Causes & Solutions**:

1. **Expired Token**

   ```typescript
   // Solution: Generate fresh token with proper expiry
   const token = new AccessToken(apiKey, apiSecret, {
     identity: userId,
     ttl: '10h', // Reasonable expiry
   });
   ```

2. **Wrong Room Name in Token**

   ```typescript
   // Token room must match connection room
   token.addGrant({
     room: roomName, // Must match room.connect(url, token)
     roomJoin: true,
   });
   ```

3. **Firewall/Corporate Network**

   ```typescript
   // Solution: Configure TURN servers
   const room = new Room({
     rtcConfig: {
       iceServers: [
         { urls: 'stun:stun.l.google.com:19302' },
         {
           urls: 'turn:your-turn-server.com:3478',
           username: 'username',
           credential: 'password',
         },
       ],
     },
   });
   ```

4. **CORS Issues (Self-Hosted)**
   ```yaml
   # LiveKit server config
   cors:
     allowed_origins:
       - 'http://localhost:3000'
       - 'https://your-domain.com'
   ```

### Issue: "Connection Keeps Dropping"

**Diagnostic Steps**:

```typescript
class ConnectionMonitor {
  private disconnectCount = 0;
  private lastDisconnect?: Date;
  private disconnectReasons: string[] = [];

  monitor(room: Room) {
    room.on('disconnected', (reason?: DisconnectReason) => {
      this.disconnectCount++;
      this.lastDisconnect = new Date();
      this.disconnectReasons.push(reason || 'unknown');

      console.log('Disconnect Analysis:', {
        count: this.disconnectCount,
        reason: reason,
        timeSinceLastDisconnect: this.getTimeSinceLast(),
        pattern: this.detectPattern(),
      });
    });

    room.on('reconnecting', () => {
      console.log('Attempting reconnection...');
    });

    room.on('reconnected', () => {
      console.log('Successfully reconnected');
    });
  }

  private detectPattern(): string {
    // Detect if disconnects follow a pattern
    if (this.disconnectCount > 3) {
      const avgTime = this.getAverageDisconnectInterval();
      if (avgTime < 30000) {
        return 'RAPID_DISCONNECTS - Likely network instability';
      } else if (avgTime === 300000) {
        return 'REGULAR_INTERVAL - Possible timeout/keepalive issue';
      }
    }
    return 'NO_PATTERN';
  }
}
```

**Solutions**:

```typescript
// Aggressive reconnection policy
const room = new Room({
  reconnectPolicy: {
    nextRetryDelayInMs: (retryCount) => {
      // Quick initial retries, then back off
      if (retryCount < 3) return 500;
      if (retryCount < 6) return 2000;
      return Math.min(5000 * retryCount, 30000);
    },
    maxRetries: 20, // More attempts
  },
  // Optimize for unstable networks
  adaptiveStream: true,
  dynacast: true,
});
```

## Track Issues

### Issue: "Camera/Microphone Not Working"

**Diagnostic Flow**:

```typescript
async function diagnoseMediaDevices() {
  // 1. Check browser permissions
  try {
    const result = await navigator.permissions.query({ name: 'camera' as any });
    console.log('Camera Permission:', result.state);
  } catch (e) {
    console.log('Permissions API not available');
  }

  // 2. Enumerate devices
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    console.log('Available Devices:', {
      cameras: devices.filter((d) => d.kind === 'videoinput'),
      microphones: devices.filter((d) => d.kind === 'audioinput'),
    });
  } catch (e) {
    console.error('Cannot enumerate devices:', e);
  }

  // 3. Test acquisition
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    console.log('✅ Media acquisition successful');

    // Clean up test stream
    stream.getTracks().forEach((track) => track.stop());
  } catch (e) {
    console.error('❌ Media acquisition failed:', e.name, e.message);

    // Specific error handling
    if (e.name === 'NotAllowedError') {
      console.log('Solution: User must grant permission');
    } else if (e.name === 'NotFoundError') {
      console.log('Solution: No camera/mic available');
    } else if (e.name === 'NotReadableError') {
      console.log('Solution: Device in use by another application');
    }
  }
}

// 4. Test with specific constraints
async function testWithConstraints() {
  const constraints = [
    { video: { width: 1920, height: 1080 } },
    { video: { width: 1280, height: 720 } },
    { video: { width: 640, height: 480 } },
    { video: true }, // Default
  ];

  for (const constraint of constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      console.log(`✅ Works with:`, constraint);
      stream.getTracks().forEach((t) => t.stop());
      break;
    } catch (e) {
      console.log(`❌ Failed with:`, constraint);
    }
  }
}
```

### Issue: "Track Not Publishing"

**Diagnostic Steps**:

```typescript
async function debugTrackPublication(room: Room) {
  const localParticipant = room.localParticipant;

  // Check room state first
  console.log('Room State:', room.state);
  if (room.state !== ConnectionState.Connected) {
    console.error('Cannot publish - room not connected');
    return;
  }

  // Check existing publications
  console.log('Current Publications:', {
    video: Array.from(localParticipant.videoTracks.keys()),
    audio: Array.from(localParticipant.audioTracks.keys()),
  });

  // Monitor publication events
  localParticipant.on('trackPublished', (publication) => {
    console.log('✅ Track Published:', {
      kind: publication.kind,
      trackSid: publication.trackSid,
      track: publication.track,
    });
  });

  localParticipant.on('trackPublicationFailed', (error, track) => {
    console.error('❌ Publication Failed:', {
      error: error.message,
      track: track?.kind,
    });
  });

  // Attempt publication with monitoring
  try {
    const track = await createLocalVideoTrack();
    console.log('Track created:', track.sid);

    const publication = await localParticipant.publishTrack(track);
    console.log('Publication result:', publication);
  } catch (error) {
    console.error('Publication error:', error);
  }
}
```

**Common Issues**:

1. **Publishing Before Connected**

   ```typescript
   // Wrong
   const room = new Room();
   room.connect(url, token);
   room.localParticipant.publishTrack(track); // Too early!

   // Right
   const room = new Room();
   await room.connect(url, token); // Wait for connection
   if (room.state === ConnectionState.Connected) {
     await room.localParticipant.publishTrack(track);
   }
   ```

2. **No Publish Permission**

   ```typescript
   // Check token permissions
   if (!room.localParticipant.permissions?.canPublish) {
     console.error('No publish permission in token');
   }
   ```

3. **Track Already Published**

   ```typescript
   // Check if already published
   const existingPublication = Array.from(localParticipant.videoTracks.values()).find(
     (p) => p.track === track,
   );

   if (existingPublication) {
     console.log('Track already published');
   }
   ```

### Issue: "Remote Tracks Not Visible"

**Diagnostic Steps**:

```typescript
function debugRemoteTracks(room: Room) {
  // Monitor all participants
  room.participants.forEach((participant) => {
    console.log(`Participant ${participant.identity}:`, {
      tracks: Array.from(participant.tracks.keys()),
      videoTracks: Array.from(participant.videoTracks.keys()),
      audioTracks: Array.from(participant.audioTracks.keys()),
    });

    // Monitor track events
    participant.on('trackSubscribed', (track, publication) => {
      console.log(`✅ Subscribed to ${participant.identity}'s ${track.kind}`);

      if (track.kind === 'video') {
        // Check if actually rendering
        const videoTrack = track as RemoteVideoTrack;
        console.log('Video details:', {
          dimensions: videoTrack.dimensions,
          isSubscribed: videoTrack.isSubscribed,
          isMuted: videoTrack.isMuted,
        });
      }
    });

    participant.on('trackUnsubscribed', (track) => {
      console.log(`❌ Unsubscribed from ${participant.identity}'s ${track.kind}`);
    });

    participant.on('trackMuted', (publication) => {
      console.log(`🔇 ${participant.identity}'s ${publication.kind} muted`);
    });
  });

  // Check subscription permissions
  if (!room.localParticipant.permissions?.canSubscribe) {
    console.error('No subscribe permission');
  }
}
```

**Common Causes**:

```typescript
// 1. Not attaching to DOM element
participant.on('trackSubscribed', (track) => {
  if (track.kind === 'video') {
    const videoElement = document.createElement('video');
    track.attach(videoElement); // Must attach!
    document.body.appendChild(videoElement); // Must add to DOM!
  }
});

// 2. Track muted but still subscribed
participant.on('trackMuted', (publication) => {
  // Hide video element but keep subscribed
  const element = document.getElementById(publication.trackSid);
  if (element) element.style.display = 'none';
});

// 3. Adaptive streaming disabled track
if (room.options?.adaptiveStream) {
  // Track might be temporarily disabled for bandwidth
  console.log('Check if track paused for bandwidth');
}
```

## Quality Issues

### Issue: "Poor Video Quality"

**Diagnostic Tools**:

```typescript
class QualityMonitor {
  async analyzeQuality(room: Room) {
    // 1. Check connection quality
    room.on('connectionQualityChanged', (quality, participant) => {
      console.log(`${participant.identity} quality:`, {
        quality: ConnectionQuality[quality],
        score: quality,
      });
    });

    // 2. Get detailed stats
    const stats = await this.getDetailedStats(room);
    console.log('Connection Stats:', stats);

    // 3. Monitor bandwidth
    this.monitorBandwidth(room);
  }

  private async getDetailedStats(room: Room) {
    const stats = {
      bandwidth: { upload: 0, download: 0 },
      resolution: { width: 0, height: 0 },
      frameRate: 0,
      packets: { sent: 0, received: 0, lost: 0 },
    };

    // Get stats from local video track
    const videoTrack = Array.from(room.localParticipant.videoTracks.values())[0]
      ?.track as LocalVideoTrack;

    if (videoTrack) {
      const rtcStats = await videoTrack.getRTCStats();

      rtcStats.forEach((stat) => {
        if (stat.type === 'outbound-rtp' && stat.mediaType === 'video') {
          stats.bandwidth.upload = stat.bytesSent;
          stats.frameRate = stat.framesPerSecond;
          stats.packets.sent = stat.packetsSent;
        }
      });
    }

    return stats;
  }

  private monitorBandwidth(room: Room) {
    let lastBytes = 0;

    setInterval(async () => {
      const videoTrack = Array.from(room.localParticipant.videoTracks.values())[0]
        ?.track as LocalVideoTrack;

      if (!videoTrack) return;

      const stats = await videoTrack.getRTCStats();
      let currentBytes = 0;

      stats.forEach((stat) => {
        if (stat.type === 'outbound-rtp') {
          currentBytes = stat.bytesSent;
        }
      });

      const bandwidth = ((currentBytes - lastBytes) * 8) / 1000; // kbps
      lastBytes = currentBytes;

      console.log(`Current bandwidth: ${bandwidth.toFixed(2)} kbps`);

      if (bandwidth < 500) {
        console.warn('Low bandwidth detected - expect quality degradation');
      }
    }, 1000);
  }
}
```

**Quality Optimization**:

```typescript
// 1. Adjust video encoding
await localParticipant.publishTrack(videoTrack, {
  videoEncoding: {
    maxBitrate: 1_500_000, // 1.5 Mbps
    maxFramerate: 30,
  },
  videoSimulcastLayers: [VideoPresets.h90, VideoPresets.h216, VideoPresets.h540],
  simulcast: true, // Enable simulcast
});

// 2. Use adaptive streaming
const room = new Room({
  adaptiveStream: true, // Auto-adjust quality
  dynacast: true, // Pause unused layers
});

// 3. Manual quality control
const setVideoQuality = async (quality: VideoQuality) => {
  const videoTrack = Array.from(localParticipant.videoTracks.values())[0]?.track as LocalVideoTrack;

  if (videoTrack) {
    await videoTrack.setVideoQuality(quality);
  }
};
```

## State Synchronization Issues

### Issue: "State Out of Sync"

**Diagnostic Pattern**:

```typescript
class StateSyncDebugger {
  private eventLog: Array<{ event: string; timestamp: number; data: any }> = [];

  logAllEvents(room: Room) {
    // Log every LiveKit event
    const events = [
      'connectionStateChanged',
      'connected',
      'disconnected',
      'participantConnected',
      'participantDisconnected',
      'trackPublished',
      'trackUnpublished',
      'trackSubscribed',
      'trackUnsubscribed',
      'trackMuted',
      'trackUnmuted',
      'activeSpeakersChanged',
      'roomMetadataChanged',
      'participantMetadataChanged',
    ];

    events.forEach((event) => {
      room.on(event as any, (...args) => {
        this.eventLog.push({
          event,
          timestamp: Date.now(),
          data: args,
        });
        console.log(`[${event}]`, ...args);
      });
    });
  }

  detectOutOfOrderEvents() {
    // Look for events that arrived out of order
    for (let i = 1; i < this.eventLog.length; i++) {
      const prev = this.eventLog[i - 1];
      const curr = this.eventLog[i];

      // Check for logical inconsistencies
      if (
        prev.event === 'trackUnsubscribed' &&
        curr.event === 'trackMuted' &&
        prev.data[0] === curr.data[0]
      ) {
        console.warn('Out of order: Mute event after unsubscribe');
      }

      if (
        prev.event === 'participantDisconnected' &&
        curr.event === 'trackPublished' &&
        prev.data[0].identity === curr.data[1].identity
      ) {
        console.warn('Out of order: Track published after disconnect');
      }
    }
  }
}
```

### Issue: "Memory Leaks"

**Detection Pattern**:

```typescript
class MemoryLeakDetector {
  private trackedObjects = new WeakMap();
  private eventListenerCounts = new Map<string, number>();

  trackRoom(room: Room) {
    // Monitor event listener accumulation
    const originalOn = room.on.bind(room);
    const originalOff = room.off.bind(room);

    room.on = (event: any, handler: any) => {
      const count = this.eventListenerCounts.get(event) || 0;
      this.eventListenerCounts.set(event, count + 1);

      if (count > 10) {
        console.warn(`Potential leak: ${count} listeners for ${event}`);
      }

      return originalOn(event, handler);
    };

    room.off = (event: any, handler: any) => {
      const count = this.eventListenerCounts.get(event) || 0;
      this.eventListenerCounts.set(event, Math.max(0, count - 1));
      return originalOff(event, handler);
    };
  }

  checkForLeaks() {
    // Check for common leaks
    const videoElements = document.querySelectorAll('video');
    const orphanedVideos = Array.from(videoElements).filter((video) => {
      return video.srcObject && !video.parentElement;
    });

    if (orphanedVideos.length > 0) {
      console.warn(`Found ${orphanedVideos.length} orphaned video elements`);
    }

    // Check track cleanup
    if (typeof window !== 'undefined') {
      (window as any).gc?.(); // Force garbage collection if available

      setTimeout(() => {
        const tracks = Array.from(document.querySelectorAll('video'))
          .map((v) => (v as HTMLVideoElement).srcObject)
          .filter(Boolean)
          .flatMap((stream) => (stream as MediaStream).getTracks());

        console.log(`Active tracks: ${tracks.length}`);
        tracks.forEach((track) => {
          console.log(`Track: ${track.kind}, ${track.readyState}`);
        });
      }, 1000);
    }
  }
}
```

**Cleanup Checklist**:

```typescript
class ProperCleanup {
  private cleanupTasks: Array<() => void> = [];

  setupRoom(room: Room) {
    // Track all cleanup needed
    const handlers: Array<[string, Function]> = [];

    const safeOn = (event: string, handler: Function) => {
      room.on(event as any, handler as any);
      handlers.push([event, handler]);
    };

    // Your event handlers
    safeOn('participantConnected', this.handleParticipantConnected);
    safeOn('trackPublished', this.handleTrackPublished);

    // Register cleanup
    this.cleanupTasks.push(() => {
      // Remove all event listeners
      handlers.forEach(([event, handler]) => {
        room.off(event as any, handler as any);
      });

      // Stop all local tracks
      room.localParticipant.tracks.forEach((publication) => {
        if (publication.track) {
          publication.track.stop();
        }
      });

      // Detach all video elements
      document.querySelectorAll('video').forEach((video) => {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        }
      });

      // Disconnect room
      room.disconnect();
    });
  }

  cleanup() {
    this.cleanupTasks.forEach((task) => {
      try {
        task();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    });
    this.cleanupTasks = [];
  }
}
```

## Quick Reference Card

### Debug Commands

```typescript
// Enable all logging
localStorage.setItem('lk-log-level', 'debug');

// Get room diagnostics
console.log({
  state: room.state,
  participants: room.participants.size,
  localTracks: room.localParticipant.tracks.size,
  permissions: room.localParticipant.permissions,
  isRecording: room.isRecording,
});

// Force reconnect
room.disconnect();
await room.connect(url, newToken);

// Emergency cleanup
room.localParticipant.tracks.forEach((pub) => pub.track?.stop());
room.disconnect();
```

### Common Error Codes

| Error                  | Meaning                | Solution                  |
| ---------------------- | ---------------------- | ------------------------- |
| `NotAllowedError`      | Permission denied      | Request user permission   |
| `NotFoundError`        | No device found        | Check device availability |
| `NotReadableError`     | Device in use          | Close other applications  |
| `OverconstrainedError` | Constraints too strict | Relax video constraints   |
| `ConnectionError`      | Network issue          | Check firewall/TURN       |
| `ServerError`          | LiveKit server issue   | Check server logs         |
| `Unauthorized`         | Invalid token          | Regenerate token          |

## Summary

Most LiveKit issues stem from:

1. **Misunderstanding state machines** - Everything has a lifecycle
2. **Ignoring event-driven nature** - Events arrive continuously
3. **Assuming immediate consistency** - Everything is eventually consistent
4. **Poor cleanup** - Resources must be explicitly released
5. **Wrong integration point** - Client vs server, ephemeral vs persistent

Always approach debugging systematically, starting with the foundation.
