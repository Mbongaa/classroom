# Voice Segmenter Agent

**Purpose**: LiveKit agent that segments teacher audio using Silero VAD and optionally translates with Gemini

**Architecture**: Runs as separate Python process alongside Next.js app

---

## Quick Start (Windows)

### Setup (One Time)

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

rem Install dependencies
pip install -r requirements.txt
```

### Run Agent (Every Time)

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Activate virtual environment
venv\Scripts\activate

rem Start agent in development mode
python agent.py dev
```

### Test Configuration

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
python test_config.py
```

---

## Development Workflow

**Two terminals always running**:

**Terminal 1** - Next.js App:
```cmd
cd C:\Users\HP\Desktop\meet
pnpm dev
```

**Terminal 2** - Python Agent:
```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
python agent.py dev
```

---

## File Structure

```
voice-segmenter/
├── agent.py              # Main agent entry point
├── config.py             # Configuration
├── requirements.txt      # Dependencies
├── .env                  # Environment variables
├── test_config.py        # Configuration test
├── venv/                 # Virtual environment
├── segments/             # Output directory (created automatically)
│   └── <room-name>/
│       ├── *.wav        # Audio segments
│       └── *.txt        # Translations (Phase 3)
└── logs/                 # Log files (optional)
```

---

## Environment Variables (.env)

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=YOUR_API_KEY
LIVEKIT_API_SECRET=YOUR_API_SECRET

# Gemini API (for translation)
GEMINI_API_KEY=YOUR_GEMINI_KEY

# Output Settings
OUTPUT_DIR=segments
SAVE_AUDIO=true
SAVE_TRANSLATIONS=false

# Logging
LOG_LEVEL=INFO
```

---

## Phase Implementation Status

- [x] **Phase 1**: Agent setup & connection ✅
- [ ] **Phase 2**: VAD segmentation & .wav saving
- [ ] **Phase 3**: Gemini translation & live captions

---

## Troubleshooting

### Agent doesn't start

```cmd
rem Check Python version
python --version

rem Verify venv activated (should see (venv) in prompt)
venv\Scripts\activate

rem Test configuration
python test_config.py
```

### Dependencies missing

```cmd
rem Reinstall dependencies
venv\Scripts\activate
pip install -r requirements.txt
```

### Can't find .env file

```cmd
rem Check if .env exists
type .env

rem If missing, check WINDOWS_SETUP_COMMANDS.md for recreation steps
```

---

## Next Steps

See `PYTHON_AGENT_EXECUTION_PLAN.md` for complete implementation guide.
