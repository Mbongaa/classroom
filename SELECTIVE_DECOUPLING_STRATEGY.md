# Selective Decoupling Strategy: Keep Python Agent for Other Apps

**Problem**: Want to keep Python Bayaan server running for App B, but decouple from App A (classroom)

**Solution**: Filter which rooms the Python agent joins

---

## 🎯 Solution Options (Choose One)

### Option 1: Room Name Filtering ⭐ RECOMMENDED

**How it works**: Python agent only joins rooms with specific prefixes/patterns

#### Implementation:

**Modify Python Agent** (`Translator Server/Bayaan-server/main.py`):

```python
# Add at the top of request_fnc (around line 877)
async def request_fnc(req: JobRequest):
    room_name = req.room.name if req.room else 'unknown'
    logger.info(f"🎯 Received job request for room: {room_name}")

    # ✅ NEW: Filter which rooms to join
    # Only join rooms for "other app" (not classroom app)
    ALLOWED_PREFIXES = ['mosque_', 'sermon_', 'lecture_']  # Your other app's rooms
    BLOCKED_PREFIXES = ['classroom_']  # This classroom app's rooms

    # Check if room should be handled by this agent
    should_join = False

    # Allow specific prefixes
    for prefix in ALLOWED_PREFIXES:
        if room_name.startswith(prefix):
            should_join = True
            break

    # Block specific prefixes
    for prefix in BLOCKED_PREFIXES:
        if room_name.startswith(prefix):
            logger.info(f"⏭️ Skipping classroom room: {room_name} (blocked prefix)")
            return  # Don't join this room

    # If no prefix match, check room metadata
    if not should_join:
        # Check room metadata to decide
        metadata = req.room.metadata if req.room and req.room.metadata else ''
        try:
            import json
            meta_dict = json.loads(metadata) if metadata else {}
            app_type = meta_dict.get('app_type', 'unknown')

            # Only join if it's NOT a classroom
            if app_type == 'classroom':
                logger.info(f"⏭️ Skipping classroom room: {room_name} (metadata)")
                return

            should_join = True
        except:
            # If can't parse metadata, be conservative - skip it
            logger.warning(f"⚠️ Could not parse metadata for room {room_name}, skipping")
            return

    # Accept job if all checks passed
    if should_join:
        await req.accept(
            name="agent",
            identity="agent",
        )
        logger.info(f"✅ Accepted job request for room: {room_name}")
    else:
        logger.info(f"⏭️ Skipped room: {room_name} (no matching criteria)")
```

#### Your Classroom App Changes:

**None needed!** Just ensure your classroom rooms are created with:
- Room names that DON'T match Python agent's allowed prefixes
- OR room metadata with `app_type: 'classroom'`

#### Verification:

```python
# Python agent logs will show:
"⏭️ Skipping classroom room: classroom_abc123 (blocked prefix)"
"✅ Accepted job request for room: mosque_12345"
```

---

### Option 2: Separate LiveKit Projects 💰 COSTS MONEY

**How it works**: Use different LiveKit Cloud projects for each app

#### Setup:

**Classroom App** (New LiveKit Project):
```env
# .env.local (Classroom App)
LIVEKIT_URL=wss://classroom-app-xyz.livekit.cloud  # NEW project
LIVEKIT_API_KEY=APInewkey123
LIVEKIT_API_SECRET=newsecret456
```

**Other App** (Existing LiveKit Project):
```env
# Python agent uses existing project
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud  # OLD project
LIVEKIT_API_KEY=API3iYYRirpXUmf
LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C
```

#### Pros:
- ✅ Complete isolation (no room name collisions)
- ✅ Separate billing/usage tracking
- ✅ No agent code changes needed

#### Cons:
- ❌ Costs more (2 LiveKit projects)
- ❌ More API keys to manage

---

### Option 3: Agent Identity Differentiation 🔀

**How it works**: Python agent uses different identity, Node.js agent uses "agent"

#### Implementation:

**Modify Python Agent**:
```python
# main.py line 881-883
await req.accept(
    name="legacy-agent",      # Changed from "agent"
    identity="legacy-agent",  # Changed from "agent"
)
```

**Your Other App** (must be updated):
```typescript
// Look for legacy-agent instead
const agentParticipant = room.remoteParticipants.find(
  p => p.identity === 'legacy-agent'  // Changed from 'agent'
);
```

**Classroom App** (no changes):
```typescript
// Still looks for "agent"
const agentParticipant = room.remoteParticipants.find(
  p => p.identity === 'agent'  // Node.js agent will use this
);
```

#### Pros:
- ✅ Both agents can coexist in same LiveKit project
- ✅ Each app connects to correct agent

#### Cons:
- ❌ Requires updating "other app" code
- ⚠️ If both agents join same room, could cause confusion

---

## 📊 Comparison Table

| Option | Complexity | Cost | Code Changes | Best For |
|--------|-----------|------|--------------|----------|
| **Room Filtering** ⭐ | Low | Free | Python only | Most cases |
| **Separate Projects** | Medium | $$ | None | Complete isolation |
| **Different Identity** | Low | Free | Both apps | Legacy support |

---

## 🎯 Recommended: Option 1 (Room Filtering)

### Why?
- ✅ Free (no extra LiveKit project)
- ✅ Minimal code changes (Python agent only)
- ✅ Flexible (can adjust filters anytime)
- ✅ No frontend changes needed

### How to Implement:

#### Step 1: Identify Room Naming Pattern

**Check your other app's room names**:
```bash
# Example room names
mosque_546012_room_123    # ← Python agent should join
sermon_2024_01_15         # ← Python agent should join
classroom_abc123          # ← Python agent should SKIP
```

#### Step 2: Update Python Agent

Add filtering logic to `request_fnc()` as shown above.

#### Step 3: Test Both Apps

**Test Other App**:
1. Create room with name like `mosque_test_123`
2. Python agent should join ✅
3. Translations should work ✅

**Test Classroom App**:
1. Create room (any name or with `classroom_` prefix)
2. Python agent should NOT join ✅
3. Frontend shows "Waiting for translation service..." ✅

#### Step 4: Deploy Node.js Agent

Now safe to deploy Node.js agent for classroom app!

---

## 🔍 How to Check Room Names

### Your Classroom App:

**Check connection details API**:
```typescript
// app/api/connection-details/route.ts (line 74)
livekitRoomName = classroom.id;  // Uses UUID
```

Your classroom rooms use **UUID** format like:
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Your Other App:

**Check how rooms are named there**. If they use a different pattern (e.g., `mosque_*`), you're good!

---

## ⚡ Quick Implementation (5 Minutes)

### Simplest Filter (If Classroom Uses UUIDs):

```python
async def request_fnc(req: JobRequest):
    room_name = req.room.name if req.room else 'unknown'
    logger.info(f"🎯 Received job request for room: {room_name}")

    # ✅ SIMPLE: Skip if room name looks like a UUID (classroom app)
    import re
    uuid_pattern = r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'

    if re.match(uuid_pattern, room_name):
        logger.info(f"⏭️ Skipping UUID room (classroom): {room_name}")
        return  # Don't join classroom rooms

    # Accept all non-UUID rooms (other app)
    await req.accept(name="agent", identity="agent")
    logger.info(f"✅ Accepted job request for room: {room_name}")
```

**Done!** Python agent now skips classroom rooms, joins other app rooms.

---

## 🧪 Testing Strategy

### Test Matrix:

| App | Room Name | Python Agent | Node.js Agent | Expected Result |
|-----|-----------|--------------|---------------|-----------------|
| **Other App** | `mosque_123` | ✅ Joins | ❌ Not running | Translations work |
| **Classroom** | `uuid-123` | ❌ Skips | ⏳ Will join | Waits for Node.js |
| **Classroom** | `uuid-456` | ❌ Skips | ✅ Joins | Translations work |

### Verification Commands:

**Check Python agent logs**:
```bash
# Should see
"⏭️ Skipping UUID room (classroom): a1b2c3d4-..."
"✅ Accepted job request for room: mosque_123"
```

**Check classroom frontend**:
- Should show "⏳ Waiting for translation service..."
- Should NOT see language dropdown (until Node.js agent starts)

---

## 🚨 Troubleshooting

### Issue: Python agent still joins classroom rooms

**Solution**: Check filter logic
```python
# Add debug logging
logger.info(f"🔍 Room name: {room_name}")
logger.info(f"🔍 Matches UUID pattern: {re.match(uuid_pattern, room_name)}")
```

### Issue: Python agent skips other app rooms

**Solution**: Adjust filter pattern
```python
# Be more specific about what to skip
SKIP_PREFIXES = ['classroom-', 'test-classroom-']

for prefix in SKIP_PREFIXES:
    if room_name.startswith(prefix):
        return
```

### Issue: Both agents join same room

**Shouldn't happen if filtering is correct!**

**But if it does**:
- Check room name format
- Verify filter logic
- Consider using Option 3 (different identities)

---

## 📝 Summary

### Recommended Approach:

1. ✅ **Identify** room naming pattern for each app
2. ✅ **Add filter** to Python agent (skip classroom rooms)
3. ✅ **Test** both apps independently
4. ✅ **Deploy** Node.js agent for classroom
5. ✅ **Verify** no conflicts

### Result:

```
Python Agent → Joins mosque_* rooms → Serves Other App ✅
Python Agent → Skips UUID rooms → Ignores Classroom App ✅
Node.js Agent → Joins UUID rooms → Serves Classroom App ✅
```

**No conflicts, both agents coexist peacefully!** 🎉

---

**Ready to implement room filtering?** I can help you add the code to the Python agent!
