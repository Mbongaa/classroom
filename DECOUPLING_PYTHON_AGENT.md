# Decoupling Python Bayaan Server from Frontend

**Purpose**: Understand current connection and safely disconnect Python agent before Node.js migration

**Date**: 2025-10-08

---

## 🔍 Current Connection Pattern

### How They Connect:

```
┌─────────────────────┐
│  Python Agent       │
│  (Bayaan Server)    │
│                     │
│  identity="agent"   │◄─────┐
│  name="agent"       │      │
└─────────────────────┘      │
         │                   │
         │ Joins LiveKit     │ RPC Calls
         │ Room              │ performRpc()
         ▼                   │
┌─────────────────────┐      │
│  LiveKit Cloud      │      │
│  (Room Service)     │      │
└─────────────────────┘      │
         │                   │
         │ Participant       │
         │ Events            │
         ▼                   │
┌─────────────────────┐      │
│  Next.js Frontend   │──────┘
│  (Your Classroom)   │
│                     │
│  Looks for:         │
│  identity="agent"   │
└─────────────────────┘
```

### Key Integration Points:

#### 1. Python Agent Identity
**File**: `Translator Server/Bayaan-server/main.py` (line 881-882)

```python
await req.accept(
    name="agent",
    identity="agent",  # ← Frontend looks for this!
)
```

#### 2. Frontend RPC Discovery
**File**: `app/components/LanguageSelect.tsx` (line 42-44)

```typescript
// Find the agent participant (identity is "agent")
const agentParticipant = Array.from(room.remoteParticipants.values()).find(
  (p) => p.identity === 'agent',  // ← Looks for Python agent!
);
```

#### 3. RPC Call Pattern
**File**: `app/components/LanguageSelect.tsx` (line 57-61)

```typescript
const response = await room.localParticipant.performRpc({
  destinationIdentity: agentParticipant.identity,  // "agent"
  method: 'get/languages',
  payload: '',
});
```

---

## 🔌 Where is the Python Agent Running?

The Python agent is **NOT** part of your Next.js app. It's a **separate process**.

### Possible Locations:

#### Option 1: Render.com Deployment
- Separate Python service on Render
- Auto-starts when you deploy
- Uses same LiveKit credentials from environment variables

**Check**:
1. Go to https://render.com
2. Look for service named "bayaan-server" or similar
3. Check if it's running

#### Option 2: Local Process
- Running in terminal: `python main.py dev`
- Or background process: `pm2 start main.py`

**Check**:
```bash
# Windows
tasklist | findstr python

# Mac/Linux
ps aux | grep python
```

#### Option 3: Systemd Service (Linux Server)
- Running as system service
- Auto-starts on server boot

**Check**:
```bash
systemctl status bayaan-agent
# or
systemctl list-units | grep bayaan
```

---

## ✂️ How to Decouple (3 Steps)

### Step 1: Identify Where It's Running

**Quick Test**:
1. Start your Next.js app: `pnpm dev`
2. Join a classroom as a student
3. Check if language dropdown appears

**If dropdown shows languages** → Python agent IS running
**If dropdown shows "⏳ Waiting for translation service..."** → Python agent NOT running

---

### Step 2: Stop the Python Agent

#### If on Render.com:
1. Go to Render dashboard
2. Find "bayaan-server" (or similar) service
3. Click **"Suspend"** or **"Delete"**

#### If Local Process:
```bash
# Find process
tasklist | findstr python  # Windows
ps aux | grep python       # Mac/Linux

# Kill process
taskkill /F /PID <pid>     # Windows
kill <pid>                 # Mac/Linux
```

#### If Systemd Service:
```bash
sudo systemctl stop bayaan-agent
sudo systemctl disable bayaan-agent  # Prevent auto-start
```

---

### Step 3: Verify Decoupling

#### Test Frontend Behavior:

1. **Start Next.js**: `pnpm dev`
2. **Join a room** as student
3. **Check LanguageSelect component**:
   - ✅ Should show: "⏳ Waiting for translation service..."
   - ✅ Should NOT show language dropdown
   - ✅ Should NOT throw errors

#### Expected Console Logs:

```javascript
// LanguageSelect.tsx logs
"Translation agent not found in the room yet. Participants: [...]"
```

#### What Should Still Work:

- ✅ Room connection
- ✅ Video/audio
- ✅ Chat
- ✅ Teacher/student roles
- ✅ All non-translation features

#### What Should NOT Work:

- ❌ Language selection dropdown (waiting for agent)
- ❌ Live captions/translations
- ❌ Translation panel updates

---

## 🛡️ Safe Decoupling Checklist

Before stopping Python agent:

- [ ] **Document current setup** (screenshot Render dashboard if applicable)
- [ ] **Check if production is using it** (don't break prod!)
- [ ] **Have restart instructions ready** (in case you need to rollback)
- [ ] **Test in development first** (not production)

---

## 🔄 Rollback Plan (If Needed)

If you need the Python agent back:

### If Render.com:
1. Go to Render dashboard
2. Click service
3. Click **"Resume"** or **"Deploy"**
4. Wait 30-60 seconds for agent to start

### If Local:
```bash
cd "Translator Server/Bayaan-server"
python main.py dev
```

### If Systemd:
```bash
sudo systemctl start bayaan-agent
sudo systemctl enable bayaan-agent
```

---

## 📊 Current Status Check

Run this test to see current state:

### Test Script:

1. **Join classroom as student**
2. **Open browser console**
3. **Run**:
```javascript
// Check for agent participant
const room = window.room; // Assuming room is accessible
const agent = Array.from(room.remoteParticipants.values()).find(
  p => p.identity === 'agent'
);

console.log('Agent found:', agent ? 'YES ✅' : 'NO ❌');
console.log('Agent identity:', agent?.identity);
console.log('All participants:',
  Array.from(room.remoteParticipants.values()).map(p => p.identity)
);
```

### Expected Output:

**If Python agent IS running**:
```
Agent found: YES ✅
Agent identity: agent
All participants: ["Teacher_1234", "agent", "Student_5678"]
```

**If Python agent NOT running**:
```
Agent found: NO ❌
Agent identity: undefined
All participants: ["Teacher_1234", "Student_5678"]
```

---

## 🚀 Next Steps After Decoupling

Once Python agent is stopped and verified:

1. ✅ **Frontend gracefully handles no agent** (shows waiting message)
2. ✅ **No errors or crashes**
3. ✅ **Ready to build Node.js agent**

**You can now proceed with Phase 1** without conflicts!

The Node.js agent will join with the SAME identity:
```typescript
// Node.js agent (new)
await ctx.room.localParticipant.setName('agent');
await ctx.room.localParticipant.setIdentity('agent');
```

Frontend will automatically connect to whichever agent is available.

---

## ⚠️ Important Notes

### Don't Delete Python Code Yet!

- ✅ Keep `Translator Server/Bayaan-server/` directory
- ✅ Keep in git history
- ✅ Reference for algorithms/logic
- ❌ Just STOP the running process

### Environment Variables (Keep These!)

Your `.env.local` already has what you need:

```env
# Keep these for Node.js agent
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY=API3iYYRirpXUmf
LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C

# Add this for Node.js agent
GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0  # ✅ Already there!
```

---

## 🎯 Ready for Migration?

**Checklist**:
- [ ] Python agent stopped (verified with test)
- [ ] Frontend shows "Waiting for translation service..."
- [ ] No errors in console
- [ ] Other features still work (video, chat, etc.)

**If all checked** → ✅ **Ready to build Node.js agent!**

---

## 📞 Troubleshooting

### Issue: Can't find where Python agent is running

**Solution**: Check LiveKit Cloud dashboard
1. Go to https://cloud.livekit.io
2. Check "Active Agents" or "Workers"
3. Look for agent with identity "agent"

### Issue: Agent keeps reconnecting after I stop it

**Possible causes**:
- PM2 or process manager auto-restart
- Render.com auto-deploy on git push
- Systemd service set to restart

**Solution**: Disable auto-restart in respective service

### Issue: Frontend crashes when agent missing

**This shouldn't happen!** The frontend is designed to handle missing agent gracefully.

**If it crashes**:
- Check browser console for errors
- Check `LanguageSelect.tsx` polling logic (should handle missing agent)
- Report as bug (needs fixing before migration)

---

**Ready to proceed?** Once you've stopped the Python agent and verified, we can create the 5 phase implementation documents!
