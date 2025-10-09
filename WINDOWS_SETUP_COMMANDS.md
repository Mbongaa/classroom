# Windows Setup Commands - Python Voice Segmenter

**Platform**: Windows 10/11

**Terminal**: Command Prompt (cmd.exe) or PowerShell

---

## 🚀 Phase 1: Setup Commands (Windows)

### Step 1: Create Project Structure

**Open Command Prompt** and run:

```cmd
cd C:\Users\HP\Desktop\meet

rem Create directories
mkdir agents\voice-segmenter
mkdir agents\voice-segmenter\segments
mkdir agents\voice-segmenter\logs

rem Verify structure
dir agents\voice-segmenter
```

**Expected output**:
```
Directory of C:\Users\HP\Desktop\meet\agents\voice-segmenter

segments
logs
```

---

### Step 2: Create requirements.txt

**Copy-paste this entire block**:

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

(
echo # LiveKit Core
echo livekit==0.17.6
echo livekit-agents==0.10.6
echo livekit-plugins-silero==0.6.6
echo.
echo # Audio Processing
echo numpy==1.26.4
echo scipy==1.14.1
echo soundfile==0.12.1
echo.
echo # AI/Translation
echo google-generativeai==0.8.3
echo.
echo # Utilities
echo python-dotenv==1.0.0
echo aiofiles==24.1.0
) > requirements.txt

rem Verify file created
type requirements.txt
```

---

### Step 3: Create .env File

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

(
echo # LiveKit Configuration
echo LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
echo LIVEKIT_API_KEY=API3iYYRirpXUmf
echo LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C
echo.
echo # Gemini API
echo GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0
echo.
echo # Output Configuration
echo OUTPUT_DIR=segments
echo SAVE_AUDIO=true
echo SAVE_TRANSLATIONS=false
echo.
echo # Logging
echo LOG_LEVEL=INFO
) > .env

rem Verify file created
type .env
```

---

### Step 4: Create Virtual Environment

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Create virtual environment
python -m venv venv

rem Verify venv created
dir venv
```

**Expected output**:
```
Directory of C:\Users\HP\Desktop\meet\agents\voice-segmenter\venv

Scripts
Lib
Include
pyvenv.cfg
```

---

### Step 5: Activate Virtual Environment

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Activate virtual environment
venv\Scripts\activate

rem Your prompt should now show (venv)
```

**Your prompt should change to**:
```
(venv) C:\Users\HP\Desktop\meet\agents\voice-segmenter>
```

---

### Step 6: Install Dependencies

**With venv activated**:

```cmd
rem Make sure venv is activated (you should see (venv) in prompt)
pip install -r requirements.txt
```

**Expected output**:
```
Collecting livekit==0.17.6
  Downloading livekit-0.17.6-py3-none-any.whl (...)
Collecting livekit-agents==0.10.6
  Downloading livekit_agents-0.10.6-py3-none-any.whl (...)
...
Successfully installed livekit-0.17.6 livekit-agents-0.10.6 ...
```

**This will take 2-5 minutes**. Wait for it to complete!

---

## ✅ Phase 1 Verification Commands (Windows)

### Test 1: Check Python Version

```cmd
python --version
```

**Expected**: `Python 3.8.x` or higher

---

### Test 2: Check Virtual Environment

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Activate if not already
venv\Scripts\activate

rem Check which python is active
where python

rem Should show path to venv python
```

**Expected output**:
```
C:\Users\HP\Desktop\meet\agents\voice-segmenter\venv\Scripts\python.exe
```

---

### Test 3: Verify Dependencies Installed

```cmd
rem Check specific packages
pip show livekit
pip show google-generativeai
pip show livekit-plugins-silero
```

**Each should show**: `Name: <package>`, `Version: <version>`, `Location: ...venv\Lib\site-packages`

---

### Test 4: Start Agent (After I Create Files)

**Terminal 1** (Next.js):
```cmd
cd C:\Users\HP\Desktop\meet
pnpm dev
```

**Terminal 2** (Python Agent):
```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
python agent.py dev
```

---

## 🎯 Quick Reference - Common Windows Commands

### Navigate Directories

```cmd
cd C:\Users\HP\Desktop\meet                    rem Go to project root
cd agents\voice-segmenter                      rem Go to agent directory
cd ..                                          rem Go up one level
dir                                            rem List files
```

---

### File Operations

```cmd
type filename.txt                              rem View file contents
echo "content" > filename.txt                  rem Create file
copy file1.txt file2.txt                       rem Copy file
del filename.txt                               rem Delete file
mkdir dirname                                  rem Create directory
rmdir /s dirname                               rem Delete directory (recursive)
```

---

### Process Management

```cmd
tasklist | findstr python                      rem Find Python processes
taskkill /F /PID <pid>                        rem Kill process by PID
taskkill /F /IM python.exe                    rem Kill all Python processes
```

---

### Virtual Environment

```cmd
python -m venv venv                            rem Create venv
venv\Scripts\activate                          rem Activate venv
deactivate                                     rem Deactivate venv
```

---

## 📝 File Creation Helper (Alternative Method)

If the echo commands don't work, create files manually:

### Create requirements.txt Manually:

1. Open Notepad
2. Copy content from `PYTHON_AGENT_EXECUTION_PLAN.md`
3. Save as: `C:\Users\HP\Desktop\meet\agents\voice-segmenter\requirements.txt`

### Create .env Manually:

1. Open Notepad
2. Copy content from plan
3. Save as: `C:\Users\HP\Desktop\meet\agents\voice-segmenter\.env`

**Note**: Make sure "Save as type" is "All Files" (not .txt)

---

## 🎯 What to Run Now

**Copy-paste these in order**:

```cmd
rem 1. Navigate to project
cd C:\Users\HP\Desktop\meet

rem 2. Create directories
mkdir agents\voice-segmenter
mkdir agents\voice-segmenter\segments
mkdir agents\voice-segmenter\logs

rem 3. Navigate to agent directory
cd agents\voice-segmenter

rem 4. Create virtual environment
python -m venv venv

rem 5. Activate virtual environment
venv\Scripts\activate

rem 6. Verify activation (should show (venv) in prompt)
where python
```

**Stop here!**

After creating `requirements.txt` and `.env` files (manually or with echo commands), run:

```cmd
rem 7. Install dependencies (with venv activated)
pip install -r requirements.txt
```

---

## ✅ Checklist

**Before telling me to create Python files**:

- [ ] Directory `agents\voice-segmenter` created
- [ ] Directory `agents\voice-segmenter\segments` created
- [ ] Directory `agents\voice-segmenter\logs` created
- [ ] File `requirements.txt` created
- [ ] File `.env` created
- [ ] Virtual environment created (`venv` folder exists)
- [ ] Virtual environment activated (prompt shows `(venv)`)
- [ ] Dependencies installed (`pip install -r requirements.txt` completed successfully)

**Once all checked** → Tell me "Dependencies installed" and I'll create all the Python files! 🐍

---

## 💡 Pro Tips

**Keep venv activated**: Every time you work on the agent, activate venv first:
```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
```

**Two terminals always**:
- Terminal 1: Next.js (`pnpm dev`)
- Terminal 2: Python agent (`python agent.py dev`)

**Check what's running**:
```cmd
rem See all Python processes
tasklist | findstr python

rem See specific agent
tasklist | findstr agent.py
```

**Clean slate restart**:
```cmd
rem Kill all Python processes
taskkill /F /IM python.exe

rem Delete all segments
rmdir /s /q agents\voice-segmenter\segments
mkdir agents\voice-segmenter\segments

rem Restart agent
cd agents\voice-segmenter
venv\Scripts\activate
python agent.py dev
```
