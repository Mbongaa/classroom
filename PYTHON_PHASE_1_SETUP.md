# Python Phase 1: Agent Setup & Connection

**Goal**: Create basic Python agent that connects to LiveKit rooms

**Duration**: 1-2 hours

**Prerequisites**: Python 3.8+, pip installed

---

## 📋 Prerequisites Checklist

- [ ] Python 3.8+ installed (`python --version`)
- [ ] pip installed (`pip --version`)
- [ ] LiveKit credentials available (in Next.js `.env.local`)
- [ ] Next.js app can create rooms

---

## 🎯 Phase 1 Deliverables

1. ✅ Python agent project structure created
2. ✅ Dependencies installed
3. ✅ Agent connects to LiveKit rooms
4. ✅ Agent logs participant events
5. ✅ Agent subscribes to teacher audio tracks

---

## 📁 Step 1: Create Project Structure

```bash
cd /mnt/c/Users/HP/Desktop/meet

# Create agent directory
mkdir -p agents/voice-segmenter

# Create subdirectories
mkdir -p agents/voice-segmenter/segments  # For output files
mkdir -p agents/voice-segmenter/logs       # For log files
```

**Verify**:
```bash
ls -R agents/
```

Expected:
```
agents/:
voice-segmenter/

agents/voice-segmenter:
segments/  logs/
```

---

## 📦 Step 2: Create requirements.txt

**File**: `agents/voice-segmenter/requirements.txt`

```txt
# LiveKit Core
livekit==0.17.6
livekit-agents==0.10.6
livekit-plugins-silero==0.6.6

# Audio Processing
numpy==1.26.4
scipy==1.14.1
soundfile==0.12.1

# AI/Translation (optional for Phase 3)
google-generativeai==0.8.3

# Utilities
python-dotenv==1.0.0
aiofiles==24.1.0
```

---

## 🔧 Step 3: Create Environment Configuration

**File**: `agents/voice-segmenter/.env`

```env
# LiveKit Configuration
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY=API3iYYRirpXUmf
LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C

# Gemini API (optional, for Phase 3)
GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0

# Output Configuration
OUTPUT_DIR=segments
SAVE_AUDIO=true
SAVE_TRANSLATIONS=false

# Logging
LOG_LEVEL=INFO
```

---

## ⚙️ Step 4: Create Configuration Module

**File**: `agents/voice-segmenter/config.py`

```python
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Agent configuration from environment variables"""

    # LiveKit
    LIVEKIT_URL = os.getenv('LIVEKIT_URL', '')
    LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', '')
    LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', '')

    # Gemini
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

    # Output
    OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'segments')
    SAVE_AUDIO = os.getenv('SAVE_AUDIO', 'true').lower() == 'true'
    SAVE_TRANSLATIONS = os.getenv('SAVE_TRANSLATIONS', 'false').lower() == 'true'

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Agent
    AGENT_IDENTITY = 'voice-segmenter'
    AGENT_NAME = 'Voice Segmenter Agent'

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []

        if not cls.LIVEKIT_URL:
            errors.append('LIVEKIT_URL not set')
        if not cls.LIVEKIT_API_KEY:
            errors.append('LIVEKIT_API_KEY not set')
        if not cls.LIVEKIT_API_SECRET:
            errors.append('LIVEKIT_API_SECRET not set')

        return errors

    @classmethod
    def print_config(cls):
        """Print configuration for debugging"""
        print('🔧 Agent Configuration:')
        print(f'  LiveKit URL: {cls.LIVEKIT_URL[:30]}...' if cls.LIVEKIT_URL else '  LiveKit URL: NOT SET')
        print(f'  API Key: {cls.LIVEKIT_API_KEY[:10]}...' if cls.LIVEKIT_API_KEY else '  API Key: NOT SET')
        print(f'  Agent Identity: {cls.AGENT_IDENTITY}')
        print(f'  Output Directory: {cls.OUTPUT_DIR}')
        print(f'  Save Audio: {cls.SAVE_AUDIO}')
        print(f'  Log Level: {cls.LOG_LEVEL}')

config = Config()
```

---

## 🤖 Step 5: Create Main Agent

**File**: `agents/voice-segmenter/agent.py`

```python
import asyncio
import logging
import json
from typing import Dict, Any

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    JobRequest,
    WorkerOptions,
    cli,
)

from config import config

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('voice-segmenter')


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
    logger.info('✅ Agent prewarmed successfully')


async def entrypoint(ctx: JobContext):
    """Main entrypoint - runs for each room the agent joins"""
    logger.info(f'🚀 Agent starting for room: {ctx.room.name}')

    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f'✅ Connected to room: {ctx.room.name}')
    logger.info(f'🤖 Agent identity: {config.AGENT_IDENTITY}')

    # Log room state
    logger.info(f'📊 Room participants: {len(ctx.room.remote_participants)}')
    for participant in ctx.room.remote_participants.values():
        logger.info(f'  👤 {participant.identity} - {participant.name}')

    # Event: Participant connected
    @ctx.room.on('participant_connected')
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f'👤 Participant connected: {participant.identity}')

        # Check if teacher
        metadata = get_participant_metadata(participant)
        role = metadata.get('role', 'unknown')
        logger.info(f'  Role: {role}')

    # Event: Participant disconnected
    @ctx.room.on('participant_disconnected')
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f'👋 Participant disconnected: {participant.identity}')

    # Event: Track subscribed
    @ctx.room.on('track_subscribed')
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant
    ):
        logger.info(f'🎵 Track subscribed: {track.kind} from {participant.identity}')

        # Only process audio tracks
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            logger.debug(f'⏭️ Skipping non-audio track: {track.kind}')
            return

        # Check if teacher
        if not is_teacher(participant):
            logger.debug(f'⏭️ Skipping non-teacher audio: {participant.identity}')
            return

        logger.info(f'🎤 Teacher audio track detected: {participant.identity}')

        # TODO Phase 2: Process audio with VAD
        # For now, just log that we detected teacher audio

    logger.info('🎯 Agent ready and listening')
    logger.info('📡 Waiting for teacher to join and speak...')


def is_teacher(participant: rtc.RemoteParticipant) -> bool:
    """Check if participant is a teacher"""

    # Method 1: Check metadata
    metadata = get_participant_metadata(participant)
    if metadata.get('role') == 'teacher':
        return True

    # Method 2: Check attributes (for speaking_language)
    if participant.attributes.get('speaking_language'):
        return True

    # Method 3: Check name (fallback)
    name = participant.name.lower() if participant.name else ''
    if 'teacher' in name or 'speaker' in name:
        return True

    return False


def get_participant_metadata(participant: rtc.RemoteParticipant) -> Dict[str, Any]:
    """Extract metadata from participant"""
    try:
        if participant.metadata:
            return json.loads(participant.metadata)
    except Exception as e:
        logger.debug(f'Could not parse participant metadata: {e}')

    return {}


async def request_fnc(req: JobRequest):
    """Handle job requests - decides whether to accept room"""
    logger.info(f'🎯 Job request received for room: {req.room.name}')

    # Accept all rooms (or add filtering logic here)
    await req.accept(
        name=config.AGENT_NAME,
        identity=config.AGENT_IDENTITY
    )

    logger.info(f'✅ Accepted job request for room: {req.room.name}')


if __name__ == '__main__':
    logger.info('🚀 Starting Voice Segmenter Agent')

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            request_fnc=request_fnc
        )
    )
```

---

## 📥 Step 6: Install Dependencies

```bash
cd /mnt/c/Users/HP/Desktop/meet/agents/voice-segmenter

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Expected output**:
```
Collecting livekit==0.17.6
  Downloading livekit-0.17.6-py3-none-any.whl
...
Successfully installed livekit-0.17.6 livekit-agents-0.10.6 ...
```

---

## ✅ Step 7: Verification Tests

### Test 1: Configuration Validation

```bash
cd /mnt/c/Users/HP/Desktop/meet/agents/voice-segmenter

# Test configuration
python -c "from config import config; config.validate(); config.print_config()"
```

**Expected output**:
```
🔧 Agent Configuration:
  LiveKit URL: wss://jamaa-app-4bix2j1v...
  API Key: API3iYYRir...
  Agent Identity: voice-segmenter
  Output Directory: segments
  Save Audio: True
  Log Level: INFO
```

---

### Test 2: Start Agent (Development Mode)

**Terminal 1** - Next.js:
```bash
cd C:\Users\HP\Desktop\meet
pnpm dev
```

**Terminal 2** - Python Agent:
```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
python agent.py dev
```

**Expected agent output**:
```
🚀 Starting Voice Segmenter Agent
[2025-10-08 14:00:00] [INFO] 🔥 Prewarming agent...
[2025-10-08 14:00:00] [INFO] 🔧 Agent Configuration:
  LiveKit URL: wss://jamaa-app-4bix2j1v...
[2025-10-08 14:00:00] [INFO] ✅ Configuration validated
[2025-10-08 14:00:00] [INFO] ✅ Agent prewarmed successfully
[2025-10-08 14:00:01] [INFO] Waiting for job requests...
```

---

### Test 3: Join Room as Teacher

**Steps**:
1. Open browser: `http://localhost:3000`
2. Navigate to: `/t/test-room?classroom=true&role=teacher`
3. Enter name: "Test Teacher"
4. **Enable microphone**
5. Join room

**Expected agent output**:
```
[INFO] 🎯 Job request received for room: <uuid>
[INFO] ✅ Accepted job request for room: <uuid>
[INFO] 🚀 Agent starting for room: <uuid>
[INFO] ✅ Connected to room: <uuid>
[INFO] 🤖 Agent identity: voice-segmenter
[INFO] 📊 Room participants: 1
[INFO]   👤 Test Teacher__xxxx - Test Teacher
[INFO] 🎯 Agent ready and listening
[INFO] 👤 Participant connected: Test Teacher__xxxx
[INFO]   Role: teacher
[INFO] 🎵 Track subscribed: KIND_AUDIO from Test Teacher__xxxx
[INFO] 🎤 Teacher audio track detected: Test Teacher__xxxx
```

---

### Test 4: Verify in Browser

**Browser console** (teacher tab):
```javascript
const room = window.room;

// Check agent participant
const agent = Array.from(room.remoteParticipants.values()).find(
  p => p.identity === 'voice-segmenter'
);

console.log('Agent found:', agent ? 'YES ✅' : 'NO ❌');
console.log('Agent identity:', agent?.identity);
```

**Expected output**:
```
Agent found: YES ✅
Agent identity: voice-segmenter
```

---

## 🐛 Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'livekit'"

**Solution**:
```bash
# Make sure virtual environment is activated
# Windows:
venv\Scripts\activate

# Then reinstall:
pip install -r requirements.txt
```

---

### Issue: "LIVEKIT_URL not set"

**Solution**:
1. Check `.env` file exists in `agents/voice-segmenter/`
2. Check values are set (no quotes needed)
3. Try hardcoding temporarily to test:
   ```python
   # config.py
   LIVEKIT_URL = 'wss://jamaa-app-4bix2j1v.livekit.cloud'
   ```

---

### Issue: Agent doesn't connect to room

**Solutions**:

1. **Check LiveKit credentials**:
   ```bash
   # Verify in .env file
   cat .env | grep LIVEKIT
   ```

2. **Test manually**:
   ```python
   # Test connection
   python -c "from config import config; print(config.LIVEKIT_URL)"
   ```

3. **Check firewall**: Port 443 (WSS) must be open

---

### Issue: No "Job request received" logs

**Symptoms**:
- Agent starts
- Never shows "Job request received"
- Room created in Next.js but agent doesn't join

**Solutions**:

1. **Check agent is running**:
   ```bash
   # Should show python process
   ps aux | grep agent.py  # Mac/Linux
   tasklist | findstr python  # Windows
   ```

2. **Check LiveKit dashboard**:
   - Go to https://cloud.livekit.io
   - Check if agent worker is connected
   - Look for "voice-segmenter" in agents list

3. **Restart both services**:
   ```bash
   # Ctrl+C both terminals
   # Restart Next.js and agent
   ```

---

### Issue: Agent joins but doesn't detect teacher

**Symptoms**:
- Agent logs show "Participant connected"
- But says "⏭️ Skipping non-teacher audio"

**Solutions**:

1. **Check token metadata**:
   ```typescript
   // app/api/connection-details/route.ts
   // Verify metadata includes: { role: 'teacher' }
   ```

2. **Check URL has role=teacher**:
   ```
   /t/room-name?classroom=true&role=teacher
   # Must include role=teacher parameter
   ```

3. **Add debug logging**:
   ```python
   # In is_teacher() function
   logger.info(f'Checking if teacher: {participant.identity}')
   logger.info(f'  Metadata: {metadata}')
   logger.info(f'  Attributes: {participant.attributes}')
   ```

---

## ✅ Phase 1 Success Criteria

Before proceeding to Phase 2, verify ALL:

- [x] `pip install -r requirements.txt` completes without errors
- [x] Agent starts with `python agent.py dev`
- [x] Agent logs show "Agent prewarmed successfully"
- [x] Teacher joins room → agent logs "Participant connected"
- [x] Teacher enables mic → agent logs "Track subscribed: KIND_AUDIO"
- [x] Agent logs show "Teacher audio track detected"
- [x] Agent identity "voice-segmenter" appears in browser participants list
- [x] No errors in agent logs
- [x] No crashes for 5 minutes

---

## 🎉 Phase 1 Complete!

**What we built**:
- ✅ Python agent project structure
- ✅ Configuration system with validation
- ✅ Main agent with LiveKit connection
- ✅ Participant event handlers
- ✅ Teacher audio track detection

**What's working**:
- ✅ Agent joins rooms automatically
- ✅ Detects when teacher connects
- ✅ Subscribes to teacher audio tracks
- ✅ Ignores student audio

**What's NOT working yet** (expected):
- ❌ No audio processing (Phase 2)
- ❌ No .wav file saving (Phase 2)
- ❌ No translation (Phase 3)

---

## 📚 Next Steps

**Ready for Phase 2?**

Once all Phase 1 success criteria are met, proceed to:

**`PYTHON_PHASE_2_VAD.md`** - Silero VAD segmentation & file saving

Phase 2 will add:
- Silero VAD audio segmentation
- Speech segment extraction
- .wav file saving with timestamps
- Output directory management

---

## 💡 Quick Tips

**Development Speed**:
- Agent auto-restarts on file changes in `dev` mode
- Use `logger.info()` liberally to see what's happening
- Test with short speech segments first

**Debugging**:
- Check both agent logs AND Next.js logs
- Use browser console to inspect room state
- LiveKit dashboard shows all connected participants

**Common Patterns**:
```python
# Log everything during development
logger.info(f'Variable: {variable}')

# Check room state
logger.info(f'Remote participants: {list(ctx.room.remote_participants.keys())}')

# Test with simple rooms first
# Use: /t/simple-test?classroom=true&role=teacher
```
