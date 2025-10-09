# Phase 2: VAD Integration (Voice Activity Detection)

**Goal**: Integrate Silero VAD to segment teacher audio into speech chunks

**Duration**: 2-3 hours

**Prerequisites**: Phase 1 completed successfully

---

## 📋 Prerequisites Checklist

- [x] Phase 1 completed (agent connects, RPC working)
- [x] Agent logs show "Agent ready and listening"
- [x] Frontend language dropdown working
- [ ] Teacher can join room and enable microphone

---

## 🎯 Phase 2 Deliverables

1. ✅ Silero VAD model loaded during prewarm
2. ✅ Agent subscribes to teacher audio tracks
3. ✅ Audio segmented into speech chunks
4. ✅ Speech segments logged with text/timestamps
5. ✅ No audio processing for students (only teacher)

---

## 📦 Step 1: Verify Silero VAD Plugin

```bash
# Check if already installed (from Phase 1)
grep "@livekit/agents-plugin-silero" package.json

# If missing, install:
pnpm add @livekit/agents-plugin-silero
```

---

## 🔧 Step 2: Update Agent Prewarm (Load VAD)

**File**: `agents/translation-worker.ts`

**Update the `prewarm` function**:

```typescript
import * as silero from '@livekit/agents-plugin-silero';

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    logger.info('🔥 Prewarming agent...');

    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
      logger.error('❌ Configuration validation failed', { errors: validation.errors });
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    logger.info('✅ Configuration validated');

    // ✅ NEW: Load Silero VAD model
    logger.info('🧠 Loading Silero VAD model...');
    try {
      proc.userData.vad = await silero.VAD.load();
      logger.info('✅ Silero VAD model loaded successfully');
    } catch (error) {
      logger.error('❌ Failed to load Silero VAD model', { error });
      throw error;
    }

    logger.info('✅ Agent prewarmed successfully');
  },

  // ... entry function continues below
});
```

---

## 🎤 Step 3: Add Audio Track Subscription

**File**: `agents/translation-worker.ts`

**Add these imports at the top**:

```typescript
import { Track, TrackKind } from 'livekit-client';
import * as silero from '@livekit/agents-plugin-silero';
```

**Add inside the `entry` function, after RPC registration**:

```typescript
entry: async (ctx: JobContext) => {
  // ... existing code (connect, RPC, etc.) ...

  // ✅ NEW: Subscribe to audio tracks
  ctx.room.on(RoomEvent.TrackSubscribed, async (
    track: Track,
    publication: any,
    participant: any
  ) => {
    logger.info('🎵 Track subscribed', {
      kind: track.kind,
      participant: participant.identity,
      trackSid: track.sid
    });

    // Only process audio tracks
    if (track.kind !== TrackKind.Audio) {
      logger.debug('⏭️ Skipping non-audio track', { kind: track.kind });
      return;
    }

    // Check if this is a teacher
    const isTeacher = isTeacherParticipant(participant);

    if (!isTeacher) {
      logger.debug('⏭️ Skipping non-teacher audio', {
        participant: participant.identity
      });
      return;
    }

    logger.info('🎤 Processing teacher audio track', {
      teacher: participant.identity
    });

    // Process teacher audio
    await processTeacherAudio(ctx, track, participant);
  });

  // ... rest of existing code ...
},
```

---

## 🔍 Step 4: Add Teacher Detection Helper

**Add this helper function before `defineAgent`**:

```typescript
/**
 * Check if participant is a teacher based on metadata or attributes
 */
function isTeacherParticipant(participant: any): boolean {
  // Method 1: Check participant metadata (set during token generation)
  if (participant.metadata) {
    try {
      const metadata = JSON.parse(participant.metadata);
      if (metadata.role === 'teacher') {
        return true;
      }
    } catch (error) {
      logger.debug('Could not parse participant metadata', { error });
    }
  }

  // Method 2: Check participant attributes (set via speaking_language)
  if (participant.attributes) {
    // Teachers set speaking_language attribute
    if (participant.attributes['speaking_language']) {
      return true;
    }
  }

  // Method 3: Check participant name (fallback - less reliable)
  const name = participant.name?.toLowerCase() || '';
  if (name.includes('teacher') || name.includes('speaker')) {
    return true;
  }

  return false;
}
```

---

## 🎙️ Step 5: Create Audio Processing Function

**Add this function before `defineAgent`**:

```typescript
/**
 * Process teacher audio with VAD segmentation
 */
async function processTeacherAudio(
  ctx: JobContext,
  track: Track,
  participant: any
): Promise<void> {
  logger.info('🎧 Starting audio processing for teacher', {
    teacher: participant.identity
  });

  try {
    // Get VAD model from prewarm
    const vad = ctx.proc.userData.vad as silero.VAD;

    if (!vad) {
      logger.error('❌ VAD model not available');
      return;
    }

    // Create audio stream from track
    const audioStream = new rtc.AudioStream(track);
    logger.info('✅ Audio stream created');

    // Apply VAD segmentation
    logger.info('🔊 Starting VAD segmentation...');
    const vadStream = vad.stream(audioStream);

    // Process speech segments
    let segmentCount = 0;

    for await (const event of vadStream) {
      if (event.type === 'start_of_speech') {
        logger.debug('🎤 Speech started');
      } else if (event.type === 'end_of_speech') {
        segmentCount++;

        // Get speech frame data
        const speechData = event.speech;

        logger.info('✅ Speech segment detected', {
          segmentNumber: segmentCount,
          duration: speechData.duration,
          sampleRate: speechData.sampleRate,
          channels: speechData.channels
        });

        // TODO Phase 3: Send to transcription/translation
        // For now, just log the segment

      } else if (event.type === 'inference') {
        // VAD confidence scores (optional logging)
        logger.debug('📊 VAD inference', {
          probability: event.probability
        });
      }
    }

  } catch (error) {
    logger.error('❌ Audio processing error', {
      error,
      teacher: participant.identity
    });
  }
}
```

**Add missing import** at the top:

```typescript
import { rtc } from '@livekit/agents';
```

---

## ✅ Step 6: Verification Tests

### Test 1: Check VAD Model Loads

**Start agent**:
```bash
pnpm agent:dev
```

**Expected logs**:
```
[INFO] 🧠 Loading Silero VAD model...
[INFO] ✅ Silero VAD model loaded successfully
```

If you see errors, check:
- Silero plugin installed correctly
- No firewall blocking model download

---

### Test 2: Teacher Audio Processing

**Setup**:
1. **Terminal 1**: Run Next.js (`pnpm dev`)
2. **Terminal 2**: Run agent (`pnpm agent:dev`)
3. **Browser**: Join as teacher with microphone enabled

**Steps**:
1. Navigate to: `http://localhost:3000/t/test-vad?classroom=true&role=teacher`
2. Enter name: "Test Teacher"
3. **Enable microphone** in PreJoin
4. Join room
5. **Speak** into microphone: "Hello, this is a test"

**Expected agent logs**:
```
[INFO] 👤 Participant connected {"identity": "Test Teacher__..."}
[INFO] 🎵 Track subscribed {"kind": "audio", "participant": "Test Teacher__..."}
[INFO] 🎤 Processing teacher audio track {"teacher": "Test Teacher__..."}
[INFO] 🎧 Starting audio processing for teacher
[INFO] ✅ Audio stream created
[INFO] 🔊 Starting VAD segmentation...
[DEBUG] 🎤 Speech started
[DEBUG] 📊 VAD inference {"probability": 0.89}
[INFO] ✅ Speech segment detected {"segmentNumber": 1, "duration": 2.5}
[DEBUG] 🎤 Speech started
[INFO] ✅ Speech segment detected {"segmentNumber": 2, "duration": 1.8}
```

---

### Test 3: Student Audio Ignored

**Steps**:
1. Join as student in another browser/tab
2. Enable microphone
3. Speak

**Expected behavior**:
- ✅ Agent logs show student track subscribed
- ✅ Agent logs show "⏭️ Skipping non-teacher audio"
- ✅ NO audio processing for student

**Expected logs**:
```
[INFO] 👤 Participant connected {"identity": "Student__..."}
[INFO] 🎵 Track subscribed {"kind": "audio", "participant": "Student__..."}
[DEBUG] ⏭️ Skipping non-teacher audio {"participant": "Student__..."}
```

---

## 🐛 Troubleshooting

### Issue: VAD model fails to load

**Symptoms**:
```
[ERROR] ❌ Failed to load Silero VAD model
```

**Solutions**:

1. **Check internet connection** (model downloads on first run)
2. **Check disk space** (~50MB needed)
3. **Retry**:
   ```bash
   rm -rf ~/.cache/livekit/  # Clear cache
   pnpm agent:dev            # Retry
   ```

---

### Issue: No audio tracks subscribed

**Symptoms**:
- Agent starts fine
- Teacher joins
- No "Track subscribed" logs

**Solutions**:

1. **Check microphone enabled**:
   - Verify microphone icon NOT muted in PreJoin
   - Check browser permissions

2. **Check teacher role**:
   ```javascript
   // Browser console
   const room = window.room;
   const local = room.localParticipant;
   console.log('Metadata:', local.metadata);
   // Should include: {"role": "teacher"}
   ```

3. **Check audio track published**:
   ```javascript
   // Browser console
   Array.from(room.localParticipant.trackPublications.values())
     .filter(p => p.kind === 'audio')
   // Should show at least one audio track
   ```

---

### Issue: Teacher not detected

**Symptoms**:
- Audio track subscribed
- Logs show "⏭️ Skipping non-teacher audio"

**Solutions**:

1. **Check token metadata**:
   - Verify `/api/connection-details` sets `role: 'teacher'`
   - Check token includes metadata

2. **Check URL parameters**:
   ```
   /t/room-name?classroom=true&role=teacher
   # Must include role=teacher
   ```

3. **Fallback to name check**:
   - Use participant name with "teacher" in it
   - e.g., "Teacher John" will be detected

---

### Issue: Speech segments not detected

**Symptoms**:
- Audio processing starts
- No "Speech segment detected" logs

**Solutions**:

1. **Check microphone input level**:
   - Speak loudly and clearly
   - Check microphone not muted

2. **Check VAD sensitivity**:
   - Default threshold: 0.5
   - Can adjust in VAD.load() options

3. **Add debug logging**:
   ```typescript
   for await (const event of vadStream) {
     logger.debug('VAD event', { type: event.type });
     // See all VAD events
   }
   ```

---

## ✅ Phase 2 Success Criteria

Before proceeding to Phase 3, verify:

- [x] VAD model loads without errors
- [x] Agent subscribes to teacher audio tracks
- [x] Agent ignores student audio tracks
- [x] Speech segments detected when teacher speaks
- [x] Segment count increases with each speech burst
- [x] Logs show duration and sample rate for segments

---

## 🎉 Phase 2 Complete!

**What we built**:
- ✅ Silero VAD integration
- ✅ Audio track subscription
- ✅ Teacher detection logic
- ✅ Speech segmentation

**What's working**:
- ✅ Agent processes teacher audio only
- ✅ Speech segments extracted
- ✅ VAD confidence scores available

**What's NOT working yet** (expected):
- ❌ No transcription of segments (Phase 3)
- ❌ No translation (Phase 3)
- ❌ No live captions (Phase 3)

---

## 📚 Next Steps

**Ready for Phase 3?**

Once all Phase 2 success criteria are met, proceed to:

**`PHASE_3_TRANSLATION.md`** - Gemini translation pipeline

Phase 3 will add:
- Gemini API integration
- Batch translation processing
- Transcription publishing
- Live captions working

---

## 📊 Performance Notes

**VAD Processing**:
- Adds ~10-50ms latency per frame
- CPU usage: <5% typical
- Memory: ~100MB for model

**Optimization Tips**:
- VAD runs on audio thread (non-blocking)
- Segments buffered efficiently
- No transcoding needed (native format)

---

## 🔍 Debug Commands

**Check audio stream**:
```typescript
// Add to processTeacherAudio
console.log('Audio format:', {
  sampleRate: audioStream.sampleRate,
  channels: audioStream.channels,
  codec: audioStream.codec
});
```

**Check VAD events**:
```typescript
// Log all events
for await (const event of vadStream) {
  console.log('VAD event:', event.type, event);
}
```

**Monitor segment quality**:
```typescript
logger.info('Segment stats', {
  duration: event.speech.duration,
  samples: event.speech.numSamples,
  isEmpty: event.speech.numSamples === 0
});
```
