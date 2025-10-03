# ✅ Recording Setup Verification

## Current Status Check

### ✅ **DONE** - Already Configured

1. **R2 Storage Credentials**
   - ✅ `S3_ACCESS_KEY` = Set
   - ✅ `S3_SECRET_KEY` = Set
   - ✅ `S3_ENDPOINT` = Set
   - ✅ `S3_BUCKET` = Set
   - ✅ `S3_REGION` = Set

2. **Supabase Credentials**
   - ✅ `NEXT_PUBLIC_SUPABASE_URL` = Set
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Set
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` = Set

3. **LiveKit Credentials**
   - ✅ `LIVEKIT_URL` = Set
   - ✅ `LIVEKIT_API_KEY` = Set
   - ✅ `LIVEKIT_API_SECRET` = Set

4. **Code Implementation**
   - ✅ Auto-recording logic added
   - ✅ Recording APIs created
   - ✅ Playback UI created
   - ✅ Webhook handler created

---

## ❌ **TODO** - You Must Do These 2 Things

### **TODO 1: Run Database Migrations** (5 minutes)

**You MUST do this before testing!**

1. Go to: https://supabase.com/dashboard/project/vmxjczdwyhrierexjoph/sql
2. Click "New Query"
3. Open file: `supabase/migrations/20250131_add_recording_columns.sql`
4. Copy ALL the content
5. Paste into Supabase SQL Editor
6. Click "Run" button (bottom right)
7. You should see: ✅ "Success. No rows returned"
8. **Repeat for**: `supabase/migrations/20250131_create_translation_entries.sql`

**Why needed**: Without this, the database doesn't have the columns to store recordings.

---

### **TODO 2: Configure LiveKit Webhook** (10 minutes)

**Without this, recordings will NEVER show as "COMPLETED"**

#### For Local Testing (Use This Now):

**Step 1: Download Ngrok**
- Go to: https://ngrok.com/download
- Install ngrok

**Step 2: Start Ngrok**
```bash
ngrok http 3000
```

**Step 3: Copy the HTTPS URL**
- Ngrok will show: `Forwarding https://abc123.ngrok-free.app -> http://localhost:3000`
- Copy the HTTPS URL: `https://abc123.ngrok-free.app`

**Step 4: Add to LiveKit Cloud**
1. Go to: https://cloud.livekit.io/projects
2. Select your project: "jamaa-app-4bix2j1v"
3. Click "Settings" (left sidebar)
4. Click "Webhooks" tab
5. Click "Add Webhook"
6. Paste webhook URL: `https://abc123.ngrok-free.app/api/webhooks/livekit-egress`
7. Select events:
   - ✅ `egress_started`
   - ✅ `egress_updated`
   - ✅ `egress_ended`
8. Click "Save"

**Why needed**: LiveKit needs to tell your server when recording is done processing.

---

## 🧪 Can You Test Now?

### **YES - Partial Testing** (recordings start but won't complete)

You can test:
- ✅ Recording starts automatically
- ✅ Database row created with `status = 'ACTIVE'`
- ✅ R2 files get uploaded

You CANNOT test:
- ❌ Recording completion (stays "ACTIVE" forever)
- ❌ Playback (no URLs in database)
- ❌ Dashboard recordings (status never updates)

---

### **YES - Full Testing** (after TODO 1 + TODO 2)

After completing both TODOs above, you can test:
- ✅ Recording starts automatically when teacher joins
- ✅ Recording stops automatically when teacher leaves
- ✅ Status updates to "COMPLETED" (via webhook)
- ✅ HLS and MP4 URLs saved to database
- ✅ Playback works in `/dashboard/recordings`

---

## 🚀 Quick Start (Do This Now):

**1. Run Database Migrations** (5 min)
   - Open Supabase SQL Editor
   - Run both migration files

**2. Start Ngrok** (2 min)
   ```bash
   ngrok http 3000
   ```
   - Copy the HTTPS URL

**3. Configure LiveKit Webhook** (3 min)
   - Go to LiveKit Cloud → Settings → Webhooks
   - Add ngrok URL + `/api/webhooks/livekit-egress`
   - Enable egress events

**4. Test** (5 min)
   - Join as teacher: http://localhost:3000/rooms/TEST101?classroom=true&role=teacher
   - Check console: `[Auto-Recording] Started`
   - Wait 30 seconds, leave room
   - Check console: `[Auto-Recording] Stopped`
   - Wait 60 seconds
   - Check Supabase: status should be "COMPLETED"
   - Go to `/dashboard/recordings` and click "Watch"

---

## Summary

**Can start now?** NO - do TODO 1 + TODO 2 first (15 minutes total)

**After TODOs?** YES - fully working auto-recording!

**What to do in LiveKit?** Add webhook URL (see TODO 2 above)
