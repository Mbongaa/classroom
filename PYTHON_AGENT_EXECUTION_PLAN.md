# Python Voice Segmenter Agent - Complete Execution Plan

**Architecture**: Python Agent (Separate Process) + Next.js Frontend

**Implementation Time**: 1-2 days (3 phases)

**Last Updated**: 2025-10-08

---

## 🎯 What We're Building

```
Teacher Speaks
    ↓
Python Agent (Background Process):
    ├─ Silero VAD (detects speech segments)
    ├─ Save .wav files (audio segments)
    ├─ Gemini API (translates to student languages)
    └─ Publish to LiveKit (send captions)
    ↓
Next.js Frontend:
    └─ Display captions to students
```

**Key Point**: Python agent runs as separate process. Next.js just displays results.

---

## 📋 Pre-Implementation Checklist

Before starting Phase 1:

- [ ] Python 3.8+ installed (`python --version`)
- [ ] pip installed (`pip --version`)
- [ ] Next.js app working (`pnpm dev`)
- [ ] LiveKit credentials available (check `.env.local`)
- [ ] Gemini API key available (check `.env.local`)

---

## 🚀 Phase 1: Agent Setup & Connection

**Goal**: Python agent connects to LiveKit rooms

**Duration**: 1-2 hours

---

### 📥 Phase 1: Terminal Commands

#### Step 1.1: Create Project Structure

```bash
cd /mnt/c/Users/HP/Desktop/meet

# Create directories
mkdir -p agents/voice-segmenter
mkdir -p agents/voice-segmenter/segments
mkdir -p agents/voice-segmenter/logs
```

#### Step 1.2: Create requirements.txt

**Copy this entire block and save to file**:

```bash
cat > agents/voice-segmenter/requirements.txt << 'EOF'
# LiveKit Core
livekit==0.17.6
livekit-agents==0.10.6
livekit-plugins-silero==0.6.6

# Audio Processing
numpy==1.26.4
scipy==1.14.1
soundfile==0.12.1

# AI/Translation
google-generativeai==0.8.3

# Utilities
python-dotenv==1.0.0
aiofiles==24.1.0
EOF
```

#### Step 1.3: Create .env file

```bash
cat > agents/voice-segmenter/.env << 'EOF'
# LiveKit Configuration
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY=API3iYYRirpXUmf
LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C

# Gemini API
GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0

# Output Configuration
OUTPUT_DIR=segments
SAVE_AUDIO=true
SAVE_TRANSLATIONS=false

# Logging
LOG_LEVEL=INFO
EOF
```

#### Step 1.4: Install Dependencies

```bash
cd agents/voice-segmenter

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# WINDOWS:
venv\Scripts\activate

# MAC/LINUX:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Wait for installation to complete** (2-5 minutes)

---

### 📝 Phase 1: Files to Create

Now I'll create the Python files for you. Tell me when dependencies are installed, and I'll generate:

1. `agents/voice-segmenter/config.py` - Configuration
2. `agents/voice-segmenter/agent.py` - Main agent
3. `agents/voice-segmenter/test_config.py` - Test script

---

### ✅ Phase 1: Verification Commands

**After I create the files, run these**:

#### Test 1: Check Configuration
```bash
cd agents/voice-segmenter
python test_config.py
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

✅ Configuration is valid!
```

#### Test 2: Start Agent (Development Mode)
```bash
# Terminal 1: Next.js (keep this running)
cd /mnt/c/Users/HP/Desktop/meet
pnpm dev

# Terminal 2: Python Agent (new terminal)
cd /mnt/c/Users/HP/Desktop/meet/agents/voice-segmenter
python agent.py dev
```

**Expected output**:
```
🚀 Starting Voice Segmenter Agent
[INFO] 🔥 Prewarming agent...
[INFO] ✅ Configuration validated
[INFO] ✅ Agent prewarmed successfully
[INFO] Waiting for job requests...
```

#### Test 3: Join Room as Teacher

**Browser**:
1. Open: `http://localhost:3000/t/test-phase1?classroom=true&role=teacher`
2. Enter name: "Test Teacher"
3. Enable microphone
4. Join room

**Expected agent logs**:
```
[INFO] 🎯 Job request received for room: <uuid>
[INFO] ✅ Accepted job request
[INFO] 🚀 Agent starting for room: <uuid>
[INFO] ✅ Connected to room
[INFO] 👤 Participant connected: Test Teacher__xxxx
[INFO]   Role: teacher
[INFO] 🎵 Track subscribed: KIND_AUDIO from Test Teacher__xxxx
[INFO] 🎤 Teacher audio track detected
```

**Browser console check**:
```javascript
const agent = Array.from(room.remoteParticipants.values()).find(p => p.identity === 'voice-segmenter');
console.log('Agent found:', agent ? 'YES ✅' : 'NO ❌');
```

---

### ✅ Phase 1 Success Criteria

**All must pass before Phase 2**:
- [x] Dependencies installed without errors
- [x] Agent starts with `python agent.py dev`
- [x] Agent logs show "Connected to room"
- [x] Teacher joins → agent logs "Participant connected"
- [x] Teacher mic on → agent logs "Track subscribed: KIND_AUDIO"
- [x] Browser console shows agent participant
- [x] No errors for 5 minutes

**If all pass** → ✅ Ready for Phase 2

**If any fail** → Stop and troubleshoot before continuing

---

## 🎙️ Phase 2: VAD Segmentation & File Saving

**Goal**: Segment teacher audio and save .wav files

**Duration**: 2-3 hours

---

### 📝 Phase 2: Files to Create

I'll create:
1. `agents/voice-segmenter/audio_processor.py` - VAD processing and file saving

Then update:
2. `agents/voice-segmenter/agent.py` - Add VAD integration

---

### ✅ Phase 2: Verification Commands

#### Test 1: Check VAD Loads

```bash
cd agents/voice-segmenter
python agent.py dev
```

**Expected logs**:
```
[INFO] 🧠 Loading Silero VAD model...
[INFO] ✅ Silero VAD model loaded successfully
[INFO] ✅ Audio processor initialized
```

#### Test 2: Generate Speech Segments

**Setup**:
- Terminal 1: Next.js (`pnpm dev`)
- Terminal 2: Agent (`python agent.py dev`)
- Browser: Join as teacher with mic

**Actions**:
1. Join: `/t/vad-test?classroom=true&role=teacher`
2. Enable microphone
3. Speak: "Hello, this is segment one" (pause 2 sec)
4. Speak: "This is segment two" (pause 2 sec)
5. Speak: "And segment three"

**Expected agent logs**:
```
[INFO] 🎧 Starting audio processing
[INFO] 🔊 Starting VAD segmentation...
[DEBUG] 🎤 Speech started
[INFO] 🎤 Speech ended, saving segment...
[INFO] 💾 Segment saved: segment_001_20251008_140523.wav (45.2KB, 2.8s)
[INFO] 💾 Segment saved: segment_002_20251008_140545.wav (38.1KB, 2.4s)
```

#### Test 3: Verify .wav Files Created

```bash
# Check output directory
ls -lh agents/voice-segmenter/segments/vad-test/

# Or Windows:
dir agents\voice-segmenter\segments\vad-test\
```

**Expected files**:
```
segment_001_20251008_140523.wav
segment_002_20251008_140545.wav
segment_003_20251008_140612.wav
```

#### Test 4: Play Audio File

```bash
# Windows:
start agents\voice-segmenter\segments\vad-test\segment_001_*.wav

# Mac:
open agents/voice-segmenter/segments/vad-test/segment_001_*.wav

# Linux:
xdg-open agents/voice-segmenter/segments/vad-test/segment_001_*.wav
```

**Expected**: Audio plays and you hear your voice saying "Hello, this is segment one"

---

### ✅ Phase 2 Success Criteria

**All must pass before Phase 3**:
- [x] VAD model loads without errors
- [x] Teacher speaks → agent logs "Speech ended"
- [x] .wav files appear in `segments/<room-name>/` directory
- [x] Files are valid audio (can play them)
- [x] Filenames have timestamps
- [x] Multiple segments saved for continuous speech
- [x] Silence periods don't create files

**If all pass** → ✅ Ready for Phase 3

---

## 🌐 Phase 3: Gemini Translation Integration

**Goal**: Add Gemini translation and publish live captions

**Duration**: 2-3 hours

**CRITICAL**: Translation happens in Python, NOT Next.js!

---

### 📝 Phase 3: Files to Create

I'll create:
1. `agents/voice-segmenter/translator.py` - Gemini translator (Python)
2. `agents/voice-segmenter/test_translator.py` - Test script

Then update:
3. `agents/voice-segmenter/audio_processor.py` - Add translation
4. `agents/voice-segmenter/agent.py` - Publish to LiveKit

---

### ✅ Phase 3: Verification Commands

#### Test 1: Test Gemini Translation (Standalone)

```bash
cd agents/voice-segmenter
python test_translator.py
```

**Expected output**:
```
🧪 Testing Gemini translator...

[INFO] ✅ Gemini translator initialized
[INFO] 🌐 Translating with Gemini: "Hello everyone, welcome to class"
[INFO] ✅ Translation completed: 3 languages

✅ Translation results:
  es: Hola a todos, bienvenidos a clase
  fr: Bonjour à tous, bienvenue en classe
  de: Hallo zusammen, willkommen im Unterricht
```

#### Test 2: End-to-End Live Captions

**Setup**:
- Terminal 1: Next.js (`pnpm dev`)
- Terminal 2: Agent (`python agent.py dev`)
- Browser Tab 1: Teacher
- Browser Tab 2: Student

**Commands**:

**Teacher actions** (Tab 1):
```
1. Navigate to: http://localhost:3000/t/translation-test?classroom=true&role=teacher
2. Enter name: "Teacher"
3. Enable microphone
4. Join room
5. Speak: "Hello everyone, welcome to the lesson"
```

**Student actions** (Tab 2):
```
1. Navigate to: http://localhost:3000/s/translation-test?classroom=true&role=student
2. Enter name: "Student"
3. Join room
4. Click language dropdown (should appear in 3-5 seconds)
5. Select: "🇪🇸 Spanish"
6. Wait for teacher to speak
```

**Expected student result**:
- ⏳ Wait 1-2 seconds after teacher speaks
- ✅ Caption appears at bottom: **"Hola a todos, bienvenidos a la lección"**

**Expected agent logs**:
```
[INFO] 📝 Student requested language: es
[INFO] ➕ Language added: es
[INFO] 🎤 Speech ended, saving segment...
[INFO] 💾 Audio saved: segment_001_20251008_140523.wav
[INFO] 🌐 Translating segment to 1 languages...
[INFO] ✅ Translation completed: 1 languages
[INFO]   💾 Translation saved: segment_001_20251008_140523_es.txt
[INFO] ✅ Published 1 translations to LiveKit
```

#### Test 3: Check Translation Files

```bash
# Check files created
ls -lh agents/voice-segmenter/segments/translation-test/

# Or Windows:
dir agents\voice-segmenter\segments\translation-test\
```

**Expected files**:
```
segment_001_20251008_140523.wav       # Audio
segment_001_20251008_140523_es.txt    # Spanish translation
```

**Read translation file**:
```bash
# Windows:
type agents\voice-segmenter\segments\translation-test\segment_001_*_es.txt

# Mac/Linux:
cat agents/voice-segmenter/segments/translation-test/segment_001_*_es.txt
```

**Expected content**:
```
Hola a todos, bienvenidos a la lección
```

#### Test 4: Multiple Languages

**Add 2 more students**:
- Student 2 → Select "🇫🇷 French"
- Student 3 → Select "🇩🇪 German"

**Teacher speaks**: "Good morning class"

**Expected results**:
- Student 1 (Spanish): "Buenos días clase"
- Student 2 (French): "Bonjour la classe"
- Student 3 (German): "Guten Morgen Klasse"

**Expected files**:
```
segment_002_20251008_140600.wav
segment_002_20251008_140600_es.txt
segment_002_20251008_140600_fr.txt
segment_002_20251008_140600_de.txt
```

---

### ✅ Phase 3 Success Criteria

**All must pass to consider complete**:
- [x] Standalone translation test works
- [x] Student selects language → agent logs show "Language added"
- [x] Teacher speaks → .wav file created
- [x] Translation .txt files created alongside .wav
- [x] **CRITICAL**: Student sees live captions in browser
- [x] Multiple students with different languages all see captions
- [x] Translations are accurate and natural
- [x] No errors for 10-minute session

**If all pass** → 🎉 **COMPLETE!** Agent is production-ready

---

## 📦 Complete Command Reference

### Daily Development Workflow

**Every time you work on this**:

```bash
# Terminal 1: Start Next.js
cd /mnt/c/Users/HP/Desktop/meet
pnpm dev

# Terminal 2: Start Python Agent
cd /mnt/c/Users/HP/Desktop/meet/agents/voice-segmenter
# Activate venv first (if using)
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # Mac/Linux

# Run agent
python agent.py dev
```

---

### Useful Debug Commands

#### Check Agent Status

```bash
# Check if agent is running
# Windows:
tasklist | findstr python

# Mac/Linux:
ps aux | grep agent.py
```

#### Check Output Files

```bash
# List all segments
ls -R agents/voice-segmenter/segments/

# Count total segments
find agents/voice-segmenter/segments/ -name "*.wav" | wc -l

# Check disk usage
du -sh agents/voice-segmenter/segments/
```

#### Clean Up Old Segments

```bash
# Delete all segments (fresh start)
rm -rf agents/voice-segmenter/segments/*

# Or Windows:
rmdir /s /q agents\voice-segmenter\segments
mkdir agents\voice-segmenter\segments
```

#### View Recent Logs

```bash
# If you configured file logging
tail -f agents/voice-segmenter/logs/agent.log

# Or just watch agent output in Terminal 2
```

---

## 🐛 Common Issues & Quick Fixes

### Issue: "ModuleNotFoundError: No module named 'livekit'"

**Fix**:
```bash
# Make sure venv is activated
cd agents/voice-segmenter
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

---

### Issue: "LIVEKIT_URL not set"

**Fix**:
```bash
# Check .env file exists
cat agents/voice-segmenter/.env

# If missing, recreate using Step 1.3 commands above
```

---

### Issue: Agent doesn't join room

**Debug**:
```bash
# Check LiveKit credentials in .env
cat agents/voice-segmenter/.env | grep LIVEKIT

# Test connection manually
python -c "from config import config; print(config.LIVEKIT_URL)"
```

---

### Issue: No .wav files created

**Debug**:
```bash
# Check permissions
ls -la agents/voice-segmenter/segments/

# Check agent logs for errors
# Should see "💾 Segment saved" messages

# Try creating file manually (test permissions)
touch agents/voice-segmenter/segments/test.txt
```

---

### Issue: Student doesn't see captions

**Debug in browser console**:
```javascript
// Check if student selected a language
const myLang = room.localParticipant.attributes?.['captions_language'];
console.log('My language:', myLang);

// Listen for transcriptions
room.on('TranscriptionReceived', (segments) => {
  console.log('📥 Received:', segments);
});

// Check captions are enabled
console.log('Captions enabled:', captionsEnabled);
```

---

## 📊 File Structure After Implementation

```
meet/
├── app/                          # Next.js (no changes)
├── agents/
│   └── voice-segmenter/         # NEW Python agent
│       ├── agent.py             # Main agent
│       ├── config.py            # Configuration
│       ├── audio_processor.py   # VAD + file saving
│       ├── translator.py        # Gemini translation
│       ├── requirements.txt     # Dependencies
│       ├── .env                 # Environment vars
│       ├── test_config.py       # Config test
│       ├── test_translator.py   # Translation test
│       ├── venv/                # Virtual environment
│       ├── segments/            # Output directory
│       │   └── <room-name>/
│       │       ├── segment_001_*.wav
│       │       ├── segment_001_*_es.txt
│       │       └── ...
│       └── logs/                # Log files
└── archived_docs/               # Old Node.js attempt
```

---

## 🎯 Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | 1-2 hours | Agent connects to rooms ✅ |
| **Phase 2** | 2-3 hours | .wav files being saved ✅ |
| **Phase 3** | 2-3 hours | Live captions working ✅ |
| **TOTAL** | **6-8 hours** | Production-ready system 🚀 |

---

## 🚀 Ready to Execute!

**Current Status**:
- ✅ Documentation created
- ✅ Terminal commands prepared
- ⏳ Waiting for your confirmation to create Python files

**Next Steps**:

1. **You run**: Phase 1 terminal commands (create dirs, install deps)
2. **I create**: Python files (config.py, agent.py, test scripts)
3. **You run**: Verification commands
4. **Repeat** for Phase 2 and Phase 3

---

## 📞 Ready to Start?

**Tell me when you've completed Step 1.4** (dependencies installed), and I'll create all the Phase 1 Python files for you!

Then you can run the verification commands and we'll move to Phase 2! 🚀
