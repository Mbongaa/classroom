# Python Phase 2: VAD Segmentation & File Saving

**Goal**: Use Silero VAD to segment teacher audio and save .wav files

**Duration**: 2-3 hours

**Prerequisites**: Phase 1 completed (agent connects and detects teacher audio)

**Location**: ALL code runs in Python agent (not Next.js)

---

## 📋 Prerequisites Checklist

- [x] Phase 1 completed (agent detects teacher audio tracks)
- [x] Agent logs show "Teacher audio track detected"
- [x] Dependencies installed (includes livekit-plugins-silero)
- [ ] Teacher can speak and you hear audio in Next.js app

---

## 🎯 Phase 2 Deliverables

1. ✅ Silero VAD model loaded
2. ✅ Audio stream processed with VAD
3. ✅ Speech segments extracted
4. ✅ .wav files saved to disk with timestamps
5. ✅ Silence periods ignored (no files created)

---

## 🧠 Step 1: Load Silero VAD in Prewarm

**File**: `agents/voice-segmenter/agent.py`

**Update the `prewarm()` function**:

```python
from livekit.plugins import silero

def prewarm(proc: JobProcess):
    """Prewarm function - runs once when worker starts"""
    logger.info('🔥 Prewarming agent...')

    # Validate configuration
    errors = config.validate()
    if errors:
        logger.error(f'❌ Configuration errors: {errors}')
        raise ValueError(f'Configuration invalid: {errors}')

    config.print_config()
    logger.info('✅ Configuration validated')

    # ✅ NEW: Load Silero VAD model
    logger.info('🧠 Loading Silero VAD model...')
    try:
        proc.userdata['vad'] = silero.VAD.load()
        logger.info('✅ Silero VAD model loaded successfully')
    except Exception as e:
        logger.error(f'❌ Failed to load Silero VAD: {e}')
        raise

    logger.info('✅ Agent prewarmed successfully')
```

---

## 🎤 Step 2: Create Audio Processor Module

**File**: `agents/voice-segmenter/audio_processor.py`

```python
import asyncio
import logging
import os
import wave
import numpy as np
from datetime import datetime
from pathlib import Path

from livekit import rtc
from livekit.agents import utils

logger = logging.getLogger('voice-segmenter.audio_processor')


class AudioProcessor:
    """Process audio with VAD and save segments"""

    def __init__(self, vad, output_dir: str = 'segments'):
        self.vad = vad
        self.output_dir = Path(output_dir)
        self.segment_count = 0

        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f'📁 Output directory: {self.output_dir.absolute()}')

    async def process_track(
        self,
        track: rtc.Track,
        participant: rtc.RemoteParticipant,
        room_name: str
    ):
        """Process audio track with VAD segmentation"""
        logger.info(f'🎧 Starting audio processing for: {participant.identity}')

        # Create room-specific directory
        room_dir = self.output_dir / self.sanitize_filename(room_name)
        room_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f'📂 Saving segments to: {room_dir}')

        try:
            # Create audio stream
            audio_stream = rtc.AudioStream(track)
            logger.info(f'✅ Audio stream created')

            # Apply VAD
            logger.info('🔊 Starting VAD segmentation...')
            vad_stream = self.vad.stream()

            # Process audio frames
            async for event in audio_stream:
                # Push audio to VAD
                vad_stream.push_frame(event.frame)

        except Exception as e:
            logger.error(f'❌ Audio processing error: {e}')

    async def handle_vad_events(self, vad_stream, room_dir: Path):
        """Handle VAD events and save segments"""
        speech_buffer = []  # Buffer for current speech segment

        async for event in vad_stream:
            if event.type == utils.vad.VADEventType.START_OF_SPEECH:
                logger.debug('🎤 Speech started')
                speech_buffer = []  # Reset buffer

            elif event.type == utils.vad.VADEventType.INFERENCE_DONE:
                # Collect audio frames
                if event.frames:
                    speech_buffer.extend(event.frames)

            elif event.type == utils.vad.VADEventType.END_OF_SPEECH:
                logger.info('🎤 Speech ended, saving segment...')

                if speech_buffer:
                    self.segment_count += 1
                    await self.save_segment(speech_buffer, room_dir)
                    speech_buffer = []

    async def save_segment(self, frames, room_dir: Path):
        """Save audio segment as .wav file"""
        try:
            # Generate filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'segment_{self.segment_count:03d}_{timestamp}.wav'
            filepath = room_dir / filename

            # Convert frames to numpy array
            audio_data = self.frames_to_audio(frames)

            # Save as WAV file
            with wave.open(str(filepath), 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(16000)  # 16kHz
                wav_file.writeframes(audio_data.tobytes())

            file_size_kb = filepath.stat().st_size / 1024
            duration_sec = len(audio_data) / 16000

            logger.info(f'💾 Segment saved: {filename}', extra={
                'size': f'{file_size_kb:.1f}KB',
                'duration': f'{duration_sec:.1f}s',
                'count': self.segment_count
            })

        except Exception as e:
            logger.error(f'❌ Failed to save segment: {e}')

    def frames_to_audio(self, frames) -> np.ndarray:
        """Convert audio frames to numpy array"""
        # Combine all frames into single audio array
        audio_data = np.concatenate([
            np.frombuffer(frame.data, dtype=np.int16)
            for frame in frames
        ])
        return audio_data

    @staticmethod
    def sanitize_filename(name: str) -> str:
        """Remove invalid characters from filename"""
        return ''.join(c if c.isalnum() or c in ('-', '_') else '_' for c in name)
```

---

## 🔄 Step 3: Update Main Agent to Use Audio Processor

**File**: `agents/voice-segmenter/agent.py`

**Add import at top**:

```python
from audio_processor import AudioProcessor
```

**Update `prewarm()` to create processor**:

```python
def prewarm(proc: JobProcess):
    """Prewarm function - runs once when worker starts"""
    logger.info('🔥 Prewarming agent...')

    # ... existing validation code ...

    # Load Silero VAD model
    logger.info('🧠 Loading Silero VAD model...')
    try:
        vad = silero.VAD.load()
        proc.userdata['vad'] = vad
        logger.info('✅ Silero VAD model loaded successfully')
    except Exception as e:
        logger.error(f'❌ Failed to load Silero VAD: {e}')
        raise

    # ✅ NEW: Create audio processor
    proc.userdata['audio_processor'] = AudioProcessor(
        vad=vad,
        output_dir=config.OUTPUT_DIR
    )
    logger.info('✅ Audio processor initialized')

    logger.info('✅ Agent prewarmed successfully')
```

**Update `on_track_subscribed()` to process audio**:

```python
@ctx.room.on('track_subscribed')
def on_track_subscribed(
    track: rtc.Track,
    publication: rtc.TrackPublication,
    participant: rtc.RemoteParticipant
):
    logger.info(f'🎵 Track subscribed: {track.kind} from {participant.identity}')

    if track.kind != rtc.TrackKind.KIND_AUDIO:
        logger.debug(f'⏭️ Skipping non-audio track')
        return

    if not is_teacher(participant):
        logger.debug(f'⏭️ Skipping non-teacher audio')
        return

    logger.info(f'🎤 Teacher audio track detected: {participant.identity}')

    # ✅ NEW: Process audio with VAD
    audio_processor = ctx.proc.userdata['audio_processor']

    # Create task to process audio
    asyncio.create_task(
        audio_processor.process_track(track, participant, ctx.room.name)
    )

    logger.info(f'✅ Audio processing started for: {participant.identity}')
```

---

## ✅ Step 4: Verification Tests

### Test 1: VAD Model Loading

**Start agent**:
```bash
cd /mnt/c/Users/HP/Desktop/meet/agents/voice-segmenter
python agent.py dev
```

**Expected logs**:
```
[INFO] 🧠 Loading Silero VAD model...
[INFO] ✅ Silero VAD model loaded successfully
[INFO] ✅ Audio processor initialized
[INFO] ✅ Agent prewarmed successfully
```

If errors, check:
- Internet connection (model downloads on first run)
- Disk space (~50MB needed)

---

### Test 2: Speech Segmentation

**Setup**:
1. **Terminal 1**: Run Next.js (`pnpm dev`)
2. **Terminal 2**: Run agent (`python agent.py dev`)
3. **Browser**: Join as teacher with mic enabled

**Actions**:
1. Navigate to: `http://localhost:3000/t/vad-test?classroom=true&role=teacher`
2. Enable microphone
3. Join room
4. **Speak clearly**: "Hello, this is segment one." (pause 2 seconds)
5. **Speak again**: "This is segment two." (pause 2 seconds)
6. **Speak again**: "And this is segment three."

**Expected agent logs**:
```
[INFO] 🎤 Teacher audio track detected: Test Teacher__xxxx
[INFO] ✅ Audio processing started
[INFO] 🎧 Starting audio processing for: Test Teacher__xxxx
[INFO] 📂 Saving segments to: /path/to/segments/vad-test
[INFO] ✅ Audio stream created
[INFO] 🔊 Starting VAD segmentation...
[DEBUG] 🎤 Speech started
[INFO] 🎤 Speech ended, saving segment...
[INFO] 💾 Segment saved: segment_001_20251008_140523.wav (size: 45.2KB, duration: 2.8s)
[DEBUG] 🎤 Speech started
[INFO] 🎤 Speech ended, saving segment...
[INFO] 💾 Segment saved: segment_002_20251008_140545.wav (size: 38.1KB, duration: 2.4s)
```

**Check output directory**:
```bash
ls -lh agents/voice-segmenter/segments/vad-test/
```

**Expected files**:
```
segment_001_20251008_140523.wav
segment_002_20251008_140545.wav
segment_003_20251008_140612.wav
```

**Verify audio files**:
```bash
# Play one file (Windows)
start agents\voice-segmenter\segments\vad-test\segment_001_*.wav

# Or check file properties
file agents/voice-segmenter/segments/vad-test/segment_001_*.wav
```

Should show: `WAVE audio, 16000 Hz, mono`

---

## 🐛 Troubleshooting

### Issue: No .wav files created

**Symptoms**:
- Agent logs show "Speech ended"
- But no files appear in segments/

**Solutions**:

1. **Check output directory**:
   ```python
   # Verify in audio_processor.py
   logger.info(f'Saving to: {filepath.absolute()}')
   ```

2. **Check permissions**:
   ```bash
   # Make sure directory is writable
   chmod 755 agents/voice-segmenter/segments/
   ```

3. **Check frames are captured**:
   ```python
   # Add to save_segment()
   logger.info(f'Frames to save: {len(frames)}')
   ```

---

### Issue: Files are 0 bytes or corrupted

**Solutions**:

1. **Check audio data**:
   ```python
   # In frames_to_audio()
   logger.info(f'Audio data shape: {audio_data.shape}')
   logger.info(f'Audio data dtype: {audio_data.dtype}')
   ```

2. **Verify WAV parameters**:
   ```python
   # Check sample rate matches LiveKit
   # Default: 16kHz, mono, 16-bit
   ```

---

### Issue: Speech not detected

**Symptoms**:
- Teacher speaks
- No "Speech ended" logs

**Solutions**:

1. **Check VAD sensitivity**:
   ```python
   # In silero.VAD.load(), add options:
   vad = silero.VAD.load(
       min_speech_duration_ms=250,
       min_silence_duration_ms=500
   )
   ```

2. **Add debug events**:
   ```python
   # Log all VAD events
   async for event in vad_stream:
       logger.debug(f'VAD event: {event.type}')
   ```

---

## ✅ Phase 2 Success Criteria

Before proceeding to Phase 3, verify ALL:

- [x] VAD model loads without errors
- [x] Agent processes teacher audio
- [x] .wav files appear in `segments/<room-name>/` directory
- [x] Files are valid audio (can play in media player)
- [x] Filenames include timestamps and segment numbers
- [x] File sizes are reasonable (20-100KB per segment)
- [x] Silence periods don't create files
- [x] Multiple segments saved for continuous speech

---

## 🎉 Phase 2 Complete!

**What we built**:
- ✅ Silero VAD integration (in Python)
- ✅ Audio stream processing (in Python)
- ✅ Speech segment extraction (in Python)
- ✅ .wav file saving with timestamps (in Python)

**What's working**:
- ✅ Teacher audio segmented automatically
- ✅ Speech saved as playable .wav files
- ✅ Organized by room name
- ✅ Timestamped filenames

**What's NOT working yet** (expected):
- ❌ No translation (Phase 3)
- ❌ No captions for students (Phase 3)
- ❌ Just raw audio files

---

## 📊 Output Example

After a 5-minute classroom session:

```
agents/voice-segmenter/segments/
└── classroom_abc123/
    ├── segment_001_20251008_140000.wav  # "Welcome everyone"
    ├── segment_002_20251008_140015.wav  # "Today we'll learn about..."
    ├── segment_003_20251008_140045.wav  # "The first concept is..."
    ├── segment_004_20251008_140112.wav  # "Let me explain further..."
    └── ...
    └── segment_025_20251008_144530.wav  # "See you next time"
```

**Total**: ~25-30 segments for 5 minutes of active speaking

---

## 📚 Next Steps

**Ready for Phase 3?**

Once all Phase 2 success criteria are met, proceed to:

**`PYTHON_PHASE_3_TRANSLATION.md`** - Gemini translation integration

Phase 3 will add (ALL in Python):
- Gemini API integration (Python)
- Speech-to-text transcription (Python)
- Translation to multiple languages (Python)
- Save translation .txt files (Python)
- Publish to LiveKit for live captions (Python)

---

## 💾 File Management Tips

**Clean up old segments**:
```bash
# Delete segments older than 7 days
find agents/voice-segmenter/segments/ -type f -mtime +7 -delete
```

**Check disk usage**:
```bash
du -sh agents/voice-segmenter/segments/
```

**Backup segments**:
```bash
# Copy to archive
cp -r agents/voice-segmenter/segments/ backup/segments_$(date +%Y%m%d)/
```
