# Documentation Index - Translation System

**Last Updated**: 2025-10-08

**Current Approach**: Python Voice Segmenter Agent

---

## 🎯 Active Documentation (Use These)

### Implementation Guides (Start Here)

**Master Plan**:
1. **`PYTHON_VOICE_SEGMENTER_IMPLEMENTATION.md`** - Overview and architecture

**Phase-by-Phase Implementation**:
2. **`PYTHON_PHASE_1_SETUP.md`** - Agent setup and connection (1-2 hours)
3. **`PYTHON_PHASE_2_VAD.md`** - VAD segmentation and file saving (2-3 hours)
4. **`PYTHON_PHASE_3_TRANSLATION.md`** - Gemini translation integration (2-3 hours)

**Total Time**: 1-2 days

---

### Supporting Documentation

**Frontend Inventory**:
- **`EXISTING_IMPLEMENTATION_INVENTORY.md`** - What's already built in Next.js (no changes needed)

**Room Filtering** (if running multiple apps):
- **`SELECTIVE_DECOUPLING_STRATEGY.md`** - How to filter which rooms agent joins

**Bayaan Server** (if using for other app):
- **`BAYAAN_SPEAKING_LANGUAGE_FIX.md`** - Fix for Bayaan server language detection

**Other Features**:
- **`MULTILINGUAL_QUESTION_TRANSLATION.md`** - Student question translation (separate feature, Next.js side)
- **`TRANSLATION_INTEGRATION.md`** - Original translation integration docs (reference)

---

## 📂 Archived Documentation (Don't Use)

**Location**: `archived_docs/nodejs_attempt_20251008/`

**Archived Files** (Node.js attempt - abandoned due to installation issues):
- TRANSLATION_AGENT_NODEJS_MIGRATION_PLAN.md
- DECOUPLING_PYTHON_AGENT.md
- PHASE_1_FOUNDATION.md (Node.js)
- PHASE_2_VAD_INTEGRATION.md (Node.js)
- PHASE_3_TRANSLATION.md (Node.js)
- PHASE_4_MULTI_LANGUAGE.md (Node.js)
- PHASE_5_PRODUCTION.md (Node.js)
- IMPLEMENTATION_QUICK_START.md (Node.js)
- TRANSLATION_AGENT_UPGRADED.md
- TRANSLATION_FIX_SUMMARY.md
- translation_integration_status.md

**Why archived**: Node.js agent installation failed (heap memory errors). Python is the standard LiveKit pattern anyway.

---

## 🏗️ Architecture Summary

### Current System (Python Agent)

```
┌──────────────────┐
│   Next.js App    │  ← UI only, displays captions
│   (Port 3000)    │
└────────┬─────────┘
         │
         │ Both connect to LiveKit independently
         │
         ▼
┌────────────────────┐
│  LiveKit Cloud     │  ← Routes audio between participants
└────────┬───────────┘
         │
         ▼
┌──────────────────────┐
│  Python Agent        │  ← ALL AI processing happens here
│  (Background)        │
│                      │
│  ✅ Silero VAD       │  (speech detection)
│  ✅ Audio segments   │  (save .wav files)
│  ✅ Gemini API       │  (translation)
│  ✅ Publish to LK    │  (send to students)
└──────────────────────┘
```

**Key Point**: Python and Next.js don't talk directly. They communicate via LiveKit.

---

## 📋 Quick Reference

### What Runs Where?

| Component | Environment | Purpose |
|-----------|-------------|---------|
| **Room UI** | Next.js | Display video/audio/captions |
| **Token generation** | Next.js API | Create LiveKit access tokens |
| **Audio segmentation** | Python agent | Silero VAD processing |
| **Translation** | Python agent | Gemini API calls |
| **File saving** | Python agent | Save .wav and .txt files |
| **Caption publishing** | Python agent | LiveKit Transcription API |
| **Caption display** | Next.js | Show captions to students |

### What's Already Done?

✅ **Frontend** (Next.js):
- Language selection UI (`LanguageSelect.tsx`)
- Caption display (`Captions.tsx`, `TranslationPanel.tsx`)
- Participant attributes (`speaking_language`, `captions_language`)
- Database saving (transcriptions, translations tables)
- API routes

✅ **Backend** (To Build):
- Python agent structure
- VAD segmentation
- Gemini translation
- LiveKit integration

---

## 🚀 Getting Started

### 1. Ensure Python Agent is for This App

If you're using Bayaan server for another app:
- See `SELECTIVE_DECOUPLING_STRATEGY.md`
- Add room filtering to Bayaan (skip classroom rooms)

### 2. Start Implementation

**Follow in order**:
1. Read `PYTHON_VOICE_SEGMENTER_IMPLEMENTATION.md` (5-10 min)
2. Implement `PYTHON_PHASE_1_SETUP.md` (1-2 hours)
3. Test Phase 1 completely before Phase 2
4. Implement `PYTHON_PHASE_2_VAD.md` (2-3 hours)
5. Test Phase 2 completely before Phase 3
6. Implement `PYTHON_PHASE_3_TRANSLATION.md` (2-3 hours)
7. Final testing and deployment

### 3. Development Workflow

**Two terminals always**:
```bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Python Agent
cd agents/voice-segmenter
python agent.py dev
```

---

## ✅ Current Status

**Documentation**: ✅ Complete (10 files created)

**Implementation**: ⏳ Ready to start

**Next Step**: 🚀 Begin `PYTHON_PHASE_1_SETUP.md`

---

## 📞 Need Help?

**During implementation**:
1. Check the specific phase document's "Troubleshooting" section
2. Verify all "Success Criteria" before moving to next phase
3. Compare with working Bayaan server for reference patterns

**Common issues**:
- Agent doesn't connect → Check `.env` credentials
- No audio processing → Verify teacher metadata has `role: 'teacher'`
- No captions → Check student selected language + agent published translations

---

## 🗂️ File Organization

```
meet/
├── app/                      # Next.js app (no changes needed)
├── agents/
│   └── voice-segmenter/     # NEW: Python agent
│       ├── agent.py
│       ├── config.py
│       ├── audio_processor.py
│       ├── translator.py
│       ├── requirements.txt
│       ├── .env
│       └── segments/         # Output directory
├── archived_docs/            # Old Node.js attempt
└── *.md                      # Active documentation
```

---

**Ready to implement?** Start with `PYTHON_PHASE_1_SETUP.md`! 🚀
