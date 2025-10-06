# Dual Database Custom Prompts - Setup & Testing Guide

## ✅ Implementation Complete

All code is now in place for dual database custom prompts. This guide shows you how to set up and test the system.

---

## 📋 What Was Implemented

### Frontend (Next.js App):

- ✅ Database migration with `translation_prompt_templates` table
- ✅ Dedicated prompts management page at `/dashboard/prompts`
- ✅ Prompt template CRUD (Create, Read, Update, Delete)
- ✅ Prompt selector in classroom creation form
- ✅ Live preview showing variable substitution
- ✅ Menu link added to dashboard sidebar

### Backend (Bayaan Server):

- ✅ Dual database configuration (mosque + classroom)
- ✅ Classroom database query function with RPC call
- ✅ Fallback chain: mosque DB → classroom DB → defaults
- ✅ Direct prompt priority in translator

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

**In your classroom Supabase project:**

```bash
# Option A: Via Supabase Dashboard
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of: supabase/migrations/20251006_add_translation_settings.sql
3. Execute the SQL

# Option B: Via CLI (if you have supabase CLI)
cd /mnt/c/Users/HP/Desktop/meet
supabase db push
```

**Verify migration:**

```sql
-- Check that columns were added
\d classrooms

-- Should show:
-- - translation_prompt_id (uuid)
-- - transcription_language (text)
-- - context_window_size (integer)

-- Check that table exists
SELECT * FROM translation_prompt_templates;

-- Should return 4 default public templates
```

---

### Step 2: Configure Bayaan Server

**Edit Bayaan server `.env` file:**

```bash
# Existing mosque database (unchanged)
SUPABASE_URL=https://bpsahvbdlkzemwjdgxmq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NEW: Add classroom database credentials
CLASSROOM_SUPABASE_URL=https://your-classroom-project.supabase.co
CLASSROOM_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Other existing env vars (unchanged)
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
SPEECHMATICS_API_KEY=...
OPENAI_API_KEY=...
```

**Where to get classroom database credentials:**

1. Go to your classroom Supabase project dashboard
2. Settings → API → Project URL (use this for CLASSROOM_SUPABASE_URL)
3. Settings → API → service_role key (use this for CLASSROOM_SUPABASE_SERVICE_ROLE_KEY)

**Restart Bayaan server:**

```bash
# Stop current instance
# Start with:
python main.py

# You should see in logs:
🔧 Configuration loaded:
   MOSQUE SUPABASE_URL: https://bpsahvbdlkzemwjdgxmq...
   MOSQUE SERVICE_KEY: ✅ SET
   CLASSROOM SUPABASE_URL: https://your-classroom...
   CLASSROOM SERVICE_KEY: ✅ SET
```

---

## 🧪 Testing Guide

### Test 1: Create Prompt Templates

1. **Start your Next.js app:**

   ```bash
   cd /mnt/c/Users/HP/Desktop/meet
   pnpm dev
   ```

2. **Navigate to prompts page:**
   - Go to `http://localhost:3000/dashboard/prompts`
   - You should see 4 default public templates

3. **Create a custom template:**
   - Click "Create New Template"
   - Name: "Test Religious"
   - Category: "religious"
   - Prompt: `You are translating religious content from {source_lang} to {target_lang}. Use reverent language and maintain spiritual tone.`
   - See live preview update as you type
   - Click "Create Template"

4. **Verify in database:**
   ```sql
   SELECT id, name, prompt_text FROM translation_prompt_templates
   WHERE organization_id IS NOT NULL;
   ```

---

### Test 2: Create Classroom with Custom Prompt

1. **Navigate to classrooms:**
   - Go to `http://localhost:3000/dashboard/rooms`

2. **Create classroom:**
   - Room Code: `test-prompt`
   - Room Type: Classroom
   - Teacher Name: Your name
   - **Translation Prompt Template:** Select "Test Religious" (or any template)
   - Click "Show Preview" to see how it will look
   - Click "Create Room"

3. **Verify in database:**

   ```sql
   SELECT room_code, name, translation_prompt_id FROM classrooms
   WHERE room_code = 'test-prompt';

   -- Should show a translation_prompt_id (UUID)
   ```

---

### Test 3: Test with Bayaan Server

1. **Join the classroom as teacher:**
   - Go to `http://localhost:3000/t/test-prompt`
   - Enter your name
   - Join the room

2. **Check Bayaan logs** - You should see:

   ```
   🔍 Looking up room context for: 8b13fc9f-5002-4508-9bec-1d385facf782
   🔍 Querying database for room: 8b13fc9f-5002-4508-9bec-1d385facf782
   (mosque query returns nothing)
   🔍 Room not found in mosque DB, trying classroom DB...
   ✅ Found classroom in classroom database: id=8b13fc9f...
   🎓 Using classroom database configuration
   📝 Custom prompt configured: You are translating religious content...
   ```

3. **Student joins and selects Spanish:**
   - Open incognito window
   - Go to `http://localhost:3000/s/test-prompt`
   - Enter name and join
   - Select Spanish from language dropdown

4. **Check Bayaan logs for translator creation:**

   ```
   🌍 Participant student_123 attributes changed: {'captions_language': 'es'}
   🆕 Added translator for ROOM ... language: Spanish
   ```

5. **Check prompt initialization:**

   ```
   ✅ Using direct prompt from database: Arabic → Spanish
   📝 Direct prompt: You are translating religious content from Arabic to Spanish. Use reverent language...
   ```

6. **Teacher speaks Arabic → Student should receive Spanish translation**

---

### Test 4: Verify Spanish Uses Custom Prompt

**What to verify:**

- Student selects Spanish (not pre-configured in classroom)
- Bayaan creates Spanish translator with `tenant_context` containing `translation_prompt`
- Translator `_initialize_prompt()` detects direct prompt
- Formats: `{source_lang}` → "Arabic", `{target_lang}` → "Spanish"
- Uses custom prompt: "You are translating religious content from Arabic to Spanish..."

**Expected Bayaan logs:**

```
🌍 Participant attributes changed: {'captions_language': 'es'}
🆕 Added translator for language: Spanish
✅ Using direct prompt from database: Arabic → Spanish
📝 Direct prompt: You are translating religious content from Arabic to Spanish. Use reverent language and maintain spiritual tone.
```

---

### Test 5: Verify Mosque Dashboard Still Works (Regression Test)

1. **Create a mosque room via mosque dashboard**
2. **Join the mosque room**
3. **Check Bayaan logs:**

   ```
   🔍 Querying database for room: mosque_546012_khutbah_20251006
   ✅ Found room in database: room_id=123, mosque_id=546012
   (classroom DB NOT queried)
   📝 Initialized translation prompt for room 123
   (Uses mosque template system - existing behavior)
   ```

4. **Verify mosque custom prompts still work**

---

### Test 6: Demo Rooms (No Database Entry)

1. **Go to landing page:** `http://localhost:3000`
2. **Create demo room** (not a persistent classroom)
3. **Join room**
4. **Check Bayaan logs:**

   ```
   🔍 Querying database for room: demo-room-xyz
   (mosque query: not found)
   🔍 Room not found in mosque DB, trying classroom DB...
   (classroom query: not found)
   ⚠️ No tenant context available for room: demo-room-xyz
   (Uses default fallback prompt)
   ```

5. **Verify demo room works with default translation**

---

## 🎯 Success Criteria Checklist

- [ ] Migration ran successfully in classroom Supabase
- [ ] 4 public templates visible in `/dashboard/prompts`
- [ ] Can create custom prompt templates
- [ ] Can edit/delete custom templates (public templates cannot be deleted)
- [ ] Classroom creation shows prompt selector dropdown
- [ ] Preview shows variable substitution
- [ ] Bayaan startup logs show both databases configured
- [ ] Classroom with custom prompt: Bayaan receives prompt via RPC
- [ ] Student selecting Spanish uses custom prompt (verified in logs)
- [ ] Mosque dashboard still works (regression test)
- [ ] Demo rooms work with default prompts

---

## 🐛 Troubleshooting

### Issue: Prompts page shows "Failed to load templates"

**Check:**

1. Migration ran successfully
2. RLS policies are in place
3. User is authenticated as teacher

**Debug:**

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'translation_prompt_templates';

-- Check if templates exist
SELECT COUNT(*) FROM translation_prompt_templates;
```

---

### Issue: Bayaan not using custom prompt

**Check Bayaan logs for:**

1. ✅ Classroom database configured in startup
2. ✅ Classroom found: `Found classroom in classroom database`
3. ✅ Prompt present: `Classroom has custom prompt: ...`
4. ✅ Direct prompt used: `Using direct prompt from database`

**Debug:**

```sql
-- Check if classroom has prompt assigned
SELECT c.room_code, c.translation_prompt_id, pt.name, pt.prompt_text
FROM classrooms c
LEFT JOIN translation_prompt_templates pt ON c.translation_prompt_id = pt.id
WHERE c.room_code = 'test-prompt';

-- Test RPC function directly
SELECT * FROM get_classroom_translation_prompt('8b13fc9f-5002-4508-9bec-1d385facf782');
```

---

### Issue: "Public templates cannot be deleted"

**Expected behavior:** This is correct! Public templates are system-wide defaults.

**Solution:** You can only delete templates you created (organization-specific).

---

## 📊 Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    DUAL DATABASE FLOW                        │
└─────────────────────────────────────────────────────────────┘

Teacher Creates Classroom:
  └─ Selects prompt template (e.g., "Test Religious")
  └─ Saves translation_prompt_id in classroom DB

Bayaan Joins Room:
  └─ Tries mosque DB by LiveKit room name (UUID)
       └─ Not found (UUID not in mosque DB)
  └─ Tries classroom DB by UUID (RPC function)
       └─ ✅ Found! Gets prompt via JOIN
       └─ Returns: { translation_prompt: "You are translating..." }

Student Selects Language:
  └─ Attribute changed: captions_language = "es"
  └─ Bayaan creates Translator(Spanish, tenant_context)
       └─ tenant_context includes translation_prompt
  └─ _initialize_prompt() detects direct_prompt
       └─ Formats: {source_lang} → "Arabic", {target_lang} → "Spanish"
       └─ Uses: "You are translating religious content from Arabic to Spanish..."

Result:
  ✅ One template works for ALL languages!
  ✅ Demo rooms unaffected (no DB entry)
  ✅ Mosque dashboard completely independent
```

---

## 🎉 Ready to Test!

Once you:

1. ✅ Run the migration
2. ✅ Add classroom database credentials to Bayaan .env
3. ✅ Restart Bayaan server

You'll be able to:

- Manage prompts at `/dashboard/prompts`
- Select prompts when creating classrooms
- Have custom translation behavior for any language students select!
