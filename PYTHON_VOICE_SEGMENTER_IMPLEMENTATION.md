# Python Voice Segmenter - Implementation Plan

**Architecture**: Standard LiveKit Agent Pattern (Separate Process)

**Date**: 2025-10-08

**Status**: Ready to implement

---

## 🎯 Architectural Understanding

### This is NOT a Workaround - It's the Standard LiveKit Pattern

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   User Browser  │◄─────►│   Next.js App    │       │  Python Agent    │
│  (Video UI)     │       │  (Port 3000)     │       │  (Background)    │
└─────────────────┘       └──────────────────┘       └──────────────────┘
         │                         │                           │
         │                         │                           │
         └─────────────────────────┴───────────────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │  LiveKit Cloud    │
                         │  (Media Server)   │
                         └───────────────────┘
```

**Key Insight**: Next.js and Python agent **don't talk to each other directly**. They both connect to LiveKit independently.

---

## 📊 Component Responsibilities

### Next.js App (Port 3000)
- ✅ Serves web UI to users
- ✅ Generates LiveKit tokens
- ✅ Manages classroom/room creation
- ✅ Handles authentication
- ❌ **Does NOT process audio** (that's agent's job)

### Python Agent (Background Process)
- ✅ Connects to LiveKit as "participant"
- ✅ Listens for audio in rooms
- ✅ Processes audio with Silero VAD
- ✅ Segments speech into .wav files
- ✅ Saves segments to storage
- ❌ **Does NOT serve HTTP** (no web server)

### LiveKit Cloud
- Routes audio/video between participants
- Notifies agents when rooms are created
- Handles WebRTC connections

---

## 🚀 Implementation Goal

**What We're Building**:

A Python agent that:
1. Joins LiveKit rooms automatically
2. Subscribes to teacher audio tracks
3. Uses Silero VAD to detect speech segments
4. Saves each speech segment as a .wav file
5. Optionally sends segments to Gemini for translation

**What We're NOT Building**:
- ❌ Web server in Python
- ❌ HTTP API endpoints
- ❌ Direct connection to Next.js
- ❌ Embedding Python in Node.js

---

## 📁 Project Structure

```
meet/
├── app/                          # Next.js app (existing)
├── agents/
│   └── voice-segmenter/         # NEW: Python agent
│       ├── agent.py             # Main entry point
│       ├── config.py            # Configuration
│       ├── audio_processor.py  # VAD + segmentation
│       ├── storage.py           # Save .wav files
│       ├── translator.py        # Optional: Gemini translation
│       ├── requirements.txt     # Python dependencies
│       ├── .env                 # Agent environment variables
│       └── README.md            # Agent documentation
```

---

## 🔧 Technology Stack

### Python Agent Dependencies
```txt
livekit==0.17.6                  # LiveKit Python SDK
livekit-agents==0.10.6           # Agent framework
livekit-plugins-silero==0.6.6    # Silero VAD
google-generativeai==0.8.3       # Gemini API (optional)
python-dotenv==1.0.0             # Environment variables
numpy==1.26.4                    # Audio processing
scipy==1.14.1                    # Signal processing
```

### Existing Next.js Dependencies (No Changes)
- Already has LiveKit client SDK
- Already has UI components
- No new packages needed

---

## 🎯 Implementation Phases (Simplified to 3 Phases)

### Phase 1: Basic Agent Setup (1-2 hours)
**Goal**: Agent connects to LiveKit and logs events

**Deliverable**:
- ✅ Python agent connects to rooms
- ✅ Logs participant joins/leaves
- ✅ Subscribes to teacher audio tracks

**Verification**: Agent logs show "Connected to room"

---

### Phase 2: VAD Segmentation (2-3 hours)
**Goal**: Segment teacher audio and save .wav files

**Deliverable**:
- ✅ Silero VAD segments speech
- ✅ Speech saved as .wav files
- ✅ Silence periods ignored
- ✅ Files named with timestamps

**Verification**: Check local directory for .wav files

---

### Phase 3: Translation Integration (2-3 hours)
**Goal**: Optionally translate segments with Gemini

**Deliverable**:
- ✅ Gemini translates each segment
- ✅ Translations saved as .txt files
- ✅ Published to LiveKit (optional)

**Verification**: Translation files appear alongside .wav files

---

## 💻 Development Workflow

### Daily Development (2 Terminals)

**Terminal 1** - Next.js App:
```bash
cd C:\Users\HP\Desktop\meet
pnpm dev
```

**Terminal 2** - Python Agent:
```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
python agent.py dev
```

**That's it!** Both auto-restart on file changes.

---

## 🚀 Production Deployment

### Deployment Pattern

**Next.js App** → Vercel/Netlify/Railway
**Python Agent** → Render/Railway/Docker Container
**LiveKit** → LiveKit Cloud (managed)

**All three are separate services** - this is standard microservices architecture.

---

## 📊 Comparison with Bayaan Server

### You Already Do This!

**Bayaan Translation Server** (your existing system):
```
Bayaan Dashboard (Next.js) → LiveKit ← Bayaan Server (Python)
                                           ├─ Speechmatics STT
                                           ├─ OpenAI Translation
                                           └─ Database integration
```

**New Voice Segmenter** (simpler version):
```
Classroom App (Next.js) → LiveKit ← Voice Segmenter (Python)
                                       ├─ Silero VAD
                                       ├─ .wav file storage
                                       └─ Optional Gemini translation
```

**Same architecture pattern!** Just simpler because:
- ❌ No database integration needed
- ❌ No multi-tenant complexity
- ❌ No Speechmatics (using local Silero VAD)
- ✅ Just segment and save audio

---

## 🔑 Key Benefits of Python Agent

### 1. Proven Technology
- ✅ LiveKit Agents framework is mature in Python
- ✅ Silero VAD works flawlessly in Python
- ✅ You already have working Bayaan server as reference

### 2. Better for Audio/AI
- ✅ NumPy/SciPy for audio processing
- ✅ Better ML library ecosystem
- ✅ More audio processing examples

### 3. Simpler Setup
- ✅ No npm memory issues
- ✅ pip install works reliably
- ✅ Smaller dependency tree

### 4. Same Deployment Model
- ✅ Docker container (just like Bayaan)
- ✅ Separate scaling (just like Bayaan)
- ✅ Independent versioning (just like Bayaan)

---

## 📋 Migration from Node.js Plan to Python Plan

### What Changes:

| Aspect | Node.js Plan | Python Plan |
|--------|--------------|-------------|
| **Language** | TypeScript | Python 3.8+ |
| **Framework** | @livekit/agents | livekit-agents |
| **VAD** | @livekit/agents-plugin-silero | livekit-plugins-silero |
| **Translation** | @google/generative-ai | google-generativeai |
| **File Structure** | agents/*.ts | agents/voice-segmenter/*.py |
| **Run Command** | node agents/index.ts | python agent.py dev |

### What Stays the Same:

- ✅ LiveKit Cloud (same credentials)
- ✅ Frontend (no changes needed)
- ✅ Database (no changes needed)
- ✅ Architecture (separate process)
- ✅ Communication (via LiveKit, not direct HTTP)

---

## 🗂️ Documentation Reorganization

### Files to Archive (Node.js Attempt)
- ✅ TRANSLATION_AGENT_NODEJS_MIGRATION_PLAN.md
- ✅ DECOUPLING_PYTHON_AGENT.md
- ✅ PHASE_1_FOUNDATION.md through PHASE_5_PRODUCTION.md
- ✅ IMPLEMENTATION_QUICK_START.md

**Moved to**: `archived_docs/nodejs_attempt_20251008/`

### Files to Keep
- ✅ EXISTING_IMPLEMENTATION_INVENTORY.md (frontend inventory - still accurate)
- ✅ SELECTIVE_DECOUPLING_STRATEGY.md (useful for room filtering)

### Files to Create (New Python Approach)
- ⏳ PYTHON_VOICE_SEGMENTER_IMPLEMENTATION.md (this file - master plan)
- ⏳ PYTHON_PHASE_1_SETUP.md (basic agent)
- ⏳ PYTHON_PHASE_2_VAD.md (VAD segmentation)
- ⏳ PYTHON_PHASE_3_TRANSLATION.md (optional Gemini)

---

## 🎯 Implementation Roadmap

### Week 1: Core Functionality

**Day 1** - Phase 1: Setup
- Create Python agent structure
- Install dependencies
- Connect to LiveKit
- Subscribe to audio tracks
- **Verify**: Agent logs show connection

**Day 2** - Phase 2: VAD Segmentation
- Integrate Silero VAD
- Segment speech
- Save .wav files
- **Verify**: .wav files appear in output directory

**Day 3** - Phase 3: Translation (Optional)
- Integrate Gemini API
- Translate segments
- Save translations
- **Verify**: Translation files alongside audio

**Day 4-5** - Testing & Polish
- Error handling
- Performance optimization
- Production deployment
- **Verify**: 1-hour stress test passes

---

## 📦 Dependencies

### Create requirements.txt

**File**: `agents/voice-segmenter/requirements.txt`

```txt
# LiveKit
livekit==0.17.6
livekit-agents==0.10.6
livekit-plugins-silero==0.6.6

# Audio Processing
numpy==1.26.4
scipy==1.14.1
soundfile==0.12.1

# AI/Translation (optional)
google-generativeai==0.8.3

# Utilities
python-dotenv==1.0.0
aiofiles==24.1.0
```

### Install

```bash
cd agents/voice-segmenter
pip install -r requirements.txt
```

---

## 🌍 Environment Variables

### Create .env file

**File**: `agents/voice-segmenter/.env`

```env
# LiveKit Configuration (same as Next.js)
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY=API3iYYRirpXUmf
LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C

# Gemini API (optional, for translation)
GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0

# Output Configuration
OUTPUT_DIR=./segments
SAVE_AUDIO=true
SAVE_TRANSLATIONS=false

# Logging
LOG_LEVEL=INFO
```

---

## 🎯 Core Features

### 1. Voice Activity Detection
```python
# Silero VAD automatically:
- Detects speech vs silence
- Segments audio at natural pauses
- Filters out background noise
- Provides confidence scores
```

### 2. Audio Segmentation
```python
# Each speech segment saved as:
segments/
  └── room_abc123/
      ├── segment_001_20251008_140523.wav
      ├── segment_002_20251008_140545.wav
      └── segment_003_20251008_140612.wav
```

### 3. Optional Translation
```python
# If enabled, also saves:
segments/
  └── room_abc123/
      ├── segment_001_20251008_140523.wav
      ├── segment_001_20251008_140523_es.txt  # Spanish
      ├── segment_001_20251008_140523_fr.txt  # French
      └── ...
```

---

## 🔄 Development Workflow

### Daily Workflow

```bash
# 1. Start Next.js (Terminal 1)
cd C:\Users\HP\Desktop\meet
pnpm dev

# 2. Start Python agent (Terminal 2)
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
python agent.py dev

# 3. Open browser
http://localhost:3000

# 4. Create classroom and speak
# 5. Check segments/ directory for .wav files
```

### Quick Iteration Cycle

```bash
# Edit agent.py
# Save file
# Agent auto-restarts (in dev mode)
# Test immediately
```

---

## 📈 Performance Expectations

| Metric | Target | Notes |
|--------|--------|-------|
| **VAD Latency** | <50ms | Silero is very fast |
| **Segment Size** | 2-10s | Natural speech pauses |
| **Memory Usage** | <200MB | Lightweight |
| **CPU Usage** | <10% | Efficient processing |
| **File Size** | ~200KB/segment | 16kHz mono WAV |

---

## 💰 Cost Analysis

### Development
- Time: 1-2 days (vs 1-2 weeks for Node.js)
- Cost: $0 (local development)

### Production (Monthly)
- Python agent hosting: $7-25/month (Render/Railway)
- Storage: $1-5/month (for .wav files)
- Gemini API: $0-100/month (if using translation)
- **Total**: ~$8-130/month

**Much simpler than full Bayaan server!**

---

## 🎓 Why This is Better Than Node.js Attempt

### Technical Reasons
1. ✅ **Works immediately** - No installation failures
2. ✅ **Mature ecosystem** - LiveKit Agents is more mature in Python
3. ✅ **Better for audio** - NumPy/SciPy are industry standard
4. ✅ **Proven patterns** - Your Bayaan server already uses this

### Practical Reasons
1. ✅ **Reference code** - Can learn from Bayaan server
2. ✅ **Faster development** - No fighting tooling
3. ✅ **Same architecture** - You already understand this pattern
4. ✅ **Production ready** - Docker deployment like Bayaan

### Developer Experience
1. ✅ **Simple setup** - `pip install` works
2. ✅ **Fast iteration** - Auto-restart in dev mode
3. ✅ **Good docs** - Python SDK is well documented
4. ✅ **Debugging** - Better Python debugging tools

---

## 🔍 Comparison: Voice Segmenter vs Bayaan Server

### Bayaan Translation Server (Existing - Complex)
```python
# Features:
- Speechmatics STT (commercial API)
- OpenAI translation
- Multi-tenant database (mosque + classroom)
- WebSocket broadcasting
- Session management
- Custom prompts from database
- 900+ lines of code

# Cost: ~$7,867/month
# Complexity: HIGH
```

### Voice Segmenter (New - Simple)
```python
# Features:
- Silero VAD (free, local)
- Save .wav segments
- Optional Gemini translation
- Simple file storage
- ~200 lines of code

# Cost: ~$8-130/month
# Complexity: LOW
```

**Voice segmenter is 10x simpler!** No database, no multi-tenancy, no complex configuration.

---

## 📋 Implementation Plan

### Phase 1: Basic Agent (1-2 hours)

**Tasks**:
1. Create `agents/voice-segmenter/` directory
2. Create `requirements.txt`
3. Create `config.py` with environment variables
4. Create `agent.py` with basic LiveKit connection
5. Test connection to LiveKit

**Success Criteria**:
- Agent starts without errors
- Agent connects to LiveKit
- Agent logs show room name and participants

---

### Phase 2: VAD Segmentation (2-3 hours)

**Tasks**:
1. Load Silero VAD model in prewarm
2. Subscribe to teacher audio tracks
3. Detect teacher via metadata
4. Apply VAD to audio stream
5. Save speech segments as .wav files

**Success Criteria**:
- Teacher speaks → .wav files appear
- Files are valid audio (can play in media player)
- Silence periods not saved
- Filenames include timestamps

---

### Phase 3: Translation (Optional, 2-3 hours)

**Tasks**:
1. Integrate Gemini API
2. Transcribe audio OR extract text from VAD
3. Translate to target languages
4. Save translations alongside .wav files
5. Optionally publish to LiveKit

**Success Criteria**:
- Translation .txt files appear
- Translations are accurate
- Students see captions (if published to LiveKit)

---

## 🔄 Integration with Existing App

### What Frontend Already Has (No Changes Needed)

✅ **Room creation** - Creates LiveKit rooms
✅ **Token generation** - Includes role metadata
✅ **Audio tracks** - Teacher publishes audio
✅ **Metadata** - Role information sent to agent

### How Agent Receives Audio

```python
# 1. Next.js creates room with teacher
# 2. Teacher enables microphone
# 3. LiveKit routes audio to ALL participants (including agent)
# 4. Agent receives audio automatically
# 5. Agent processes with VAD
```

**No API calls needed between Next.js and Python!**

---

## 📁 File Storage Strategy

### Local Storage (Development)

```
agents/voice-segmenter/segments/
└── room_20251008_abc123/
    ├── segment_001_140523.wav
    ├── segment_002_140545.wav
    └── segment_003_140612.wav
```

### Cloud Storage (Production - Optional)

**Option A**: Upload to Cloudflare R2 (you already have this)
```python
# Use existing S3_* credentials
# Upload .wav files to bucket
```

**Option B**: Local disk on server
```python
# Mount persistent volume
# Store on server disk
```

**Option C**: Database BLOB storage
```python
# Store in Supabase
# table: audio_segments (id, room_id, audio_data, created_at)
```

---

## 🎯 Use Cases

### Use Case 1: Lecture Recording with Timestamps

**Scenario**: Teacher gives 1-hour lecture

**Output**:
```
segments/lecture_20251008_math101/
├── segment_001_140000.wav  # "Welcome to class"
├── segment_002_140015.wav  # "Today we'll learn about..."
├── segment_003_140045.wav  # "The first concept is..."
└── ...
└── segment_120_150000.wav  # "See you next time"
```

**Total**: ~120 segments, 2-10 seconds each

---

### Use Case 2: Translation for Students

**Scenario**: Teacher speaks Arabic, students need English/Spanish

**Output**:
```
segments/lecture_20251008_math101/
├── segment_001_140000.wav
├── segment_001_140000_en.txt  # "Welcome to class"
├── segment_001_140000_es.txt  # "Bienvenidos a clase"
├── segment_002_140015.wav
├── segment_002_140015_en.txt
├── segment_002_140015_es.txt
└── ...
```

**Students see**: Live captions via LiveKit Transcription API

---

### Use Case 3: Post-Processing Analysis

**Scenario**: Review lecture later, search by content

**Process**:
1. Lecture happens → segments saved
2. Later: Run batch transcription on all .wav files
3. Create searchable transcript
4. Link timestamps to video recording

---

## 🚨 Important Clarifications

### This Agent Does NOT:

- ❌ Serve HTTP requests (no Flask/FastAPI)
- ❌ Connect to Next.js directly (no REST API)
- ❌ Store data in your main database (optional)
- ❌ Require complex configuration (simple .env file)

### This Agent DOES:

- ✅ Connect to LiveKit as participant
- ✅ Receive audio automatically
- ✅ Process with VAD
- ✅ Save segments to disk
- ✅ Run independently of Next.js

---

## 📚 Next Steps

### Immediate:

1. ✅ Archive Node.js docs (done)
2. ⏳ Create Python implementation phases (next)
3. ⏳ Implement Phase 1 (basic agent)
4. ⏳ Test and verify

### Documentation to Create:

1. `PYTHON_PHASE_1_SETUP.md` - Agent setup and connection
2. `PYTHON_PHASE_2_VAD.md` - VAD segmentation and file saving
3. `PYTHON_PHASE_3_TRANSLATION.md` - Optional Gemini integration

---

## ✅ Decision Summary

**Chosen Architecture**: Python Agent (Separate Process)

**Rationale**:
- Standard LiveKit pattern
- Proven technology (Bayaan server uses same)
- No installation issues
- Faster development
- Same deployment model anyway

**Timeline**: 1-2 days (vs 1-2 weeks Node.js)

**Cost**: ~$10-130/month (vs $7,867 Bayaan full server)

---

**Ready to create Python phase documents and start implementation!** 🚀
