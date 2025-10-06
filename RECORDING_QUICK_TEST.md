# 🧪 Recording Feature - Quick Testing Guide

## ✅ Prerequisites Checklist

- [x] R2 credentials added to `.env.local`
- [x] `NEXT_PUBLIC_SHOW_SETTINGS_MENU=true` set
- [x] `NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record` set
- [ ] Database migrations run in Supabase
- [ ] Dev server restarted

---

## Step 1: Run Database Migrations (5 minutes)

1. Go to: https://supabase.com/dashboard/project/vmxjczdwyhrierexjoph/sql
2. Click "New Query"
3. Copy and paste the **entire** contents of:
   - `supabase/migrations/20250131_add_recording_columns.sql`
4. Click "Run" (bottom right)
5. You should see: ✅ "Success. No rows returned"
6. Repeat for:
   - `supabase/migrations/20250131_create_translation_entries.sql`

**Verify migrations worked**:

```sql
-- Run this query in Supabase SQL Editor
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'session_recordings'
  AND column_name IN ('room_sid', 'room_name', 'session_id', 'hls_playlist_url', 'mp4_url', 'teacher_name');
```

**Expected**: Should return 6 rows with these columns.

---

## Step 2: Restart Development Server

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

**Why?** Environment variables are only loaded at server start.

---

## Step 3: Test Recording Start

1. **Join a classroom as teacher**:
   - Go to: http://localhost:3000/rooms/TEST101?classroom=true&role=teacher
   - Enter your name: "Dr. Test"
   - Join the room

2. **Open Settings Menu**:
   - Click the settings/gear icon (⚙️) in the control bar
   - You should see TWO tabs: "Media Devices" and "Recording"

3. **Start Recording**:
   - Click "Recording" tab
   - Click "Start Recording" button
   - Button should disable briefly while processing

4. **Verify in Console** (Press F12):

   ```
   [Recording] Started { success: true, recording: { ... } }
   ```

5. **Check Database** (Supabase Table Editor):
   - Go to: https://supabase.com/dashboard/project/vmxjczdwyhrierexjoph/editor
   - Click "session_recordings" table
   - You should see a NEW row:
     - `room_name`: "TEST101"
     - `session_id`: "TEST101_2025-01-31_XX-XX"
     - `status`: "ACTIVE"
     - `teacher_name`: "Dr. Test"

**If you see this row → SUCCESS! Recording started** ✅

---

## Step 4: Test Recording Stop

1. **Wait 30 seconds** (let it record some content)

2. **Stop Recording**:
   - Open settings menu again
   - Click "Recording" tab
   - Click "Stop Recording" button

3. **Verify in Console**:

   ```
   [Recording] Stopped { success: true }
   ```

4. **Wait 30-60 seconds** for LiveKit to process the egress

5. **Check Webhook Logs** in your terminal:
   - Look for: `[LiveKit Webhook] Received:`
   - Should see: `[LiveKit Webhook] Egress completed`

6. **Check Database Again**:
   ```sql
   SELECT status, hls_playlist_url, mp4_url, duration_seconds
   FROM session_recordings
   WHERE room_name = 'TEST101'
   ORDER BY started_at DESC
   LIMIT 1;
   ```

**Expected after 30-60 seconds**:

- `status`: "COMPLETED"
- `hls_playlist_url`: "https://...r2.cloudflarestorage.com/...index.m3u8"
- `mp4_url`: "https://...r2.cloudflarestorage.com/...session.mp4"
- `duration_seconds`: 30-60

---

## Step 5: Test Playback

1. **Go to Recordings Page**:
   - Navigate to: http://localhost:3000/dashboard/recordings

2. **Verify Recording Appears**:
   - You should see a card for "TEST101"
   - Status badge: "COMPLETED" (green)
   - Teacher: "Dr. Test"
   - Duration: Should show actual recording length

3. **Watch Recording**:
   - Click "Watch" button
   - Video player should load
   - Video should play (might take 5-10 seconds to buffer)
   - Test seeking: drag the progress bar forward/backward

4. **Test Download** (if MP4 available):
   - Click download button (⬇️)
   - Should download `session.mp4` file

**If video plays → SUCCESS! Playback working** ✅

---

## 🚨 Troubleshooting

### Issue: "Missing required parameters: roomSid, teacherName"

**Check**: Did you restart the dev server after adding env variables?

**Solution**:

```bash
# Stop server (Ctrl+C)
pnpm dev
```

---

### Issue: Recording never shows "COMPLETED"

**Symptoms**: Status stays "ACTIVE" forever

**Cause**: Webhook not configured or not reaching your server

**Solution for Local Testing**:

1. **Install ngrok**: https://ngrok.com/download
2. **Start ngrok**:
   ```bash
   ngrok http 3000
   ```
3. **Copy HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)
4. **Configure in LiveKit Cloud**:
   - Go to: https://cloud.livekit.io/projects
   - Click your project → Settings → Webhooks
   - Add webhook URL: `https://abc123.ngrok-free.app/api/webhooks/livekit-egress`
   - Enable events: ✅ egress_started, ✅ egress_updated, ✅ egress_ended
   - Save

5. **Test again** - webhook should now work!

---

### Issue: Video won't play

**Check Browser Console** for errors.

**Common Causes**:

1. **CORS Error**: R2 bucket needs CORS configuration
2. **URL Wrong**: Check `hls_playlist_url` is accessible in browser
3. **Public Access**: R2 bucket needs public access enabled

**Fix CORS** (R2 Dashboard → Your Bucket → Settings → CORS):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

**Enable Public Access** (R2 Dashboard → Your Bucket → Settings):

- Enable "Allow Access" or connect custom domain

---

### Issue: No "Recording" tab in settings menu

**Check**:

1. `.env.local` has `NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record`
2. Dev server was restarted after adding this
3. Settings menu icon appears (⚙️)

**Verify**:

```bash
# Print environment variables
echo $NEXT_PUBLIC_LK_RECORD_ENDPOINT
```

---

## ✅ Success Criteria

After completing all steps, you should have:

- ✅ Database has recording row with `status = "COMPLETED"`
- ✅ R2 bucket has files: `TEST101/TEST101_2025-XX-XX_XX-XX/index.m3u8`
- ✅ `/dashboard/recordings` shows the recording
- ✅ Clicking "Watch" plays the video
- ✅ Seeking works (drag progress bar)

**Once this works, you're ready for production!** 🎉

---

## 📊 What's Working Now

**Phase 1 Complete**:

- ✅ Session tracking (unique IDs per recording)
- ✅ HLS streaming playback
- ✅ MP4 downloads
- ✅ Recordings list with status
- ✅ Multi-session support (same room, different sessions)

**Phase 2 (Next)**:

- ⏳ Translation cards overlay UI
- ⏳ Email-based access system
- ⏳ Seek-to-translation functionality

---

## 🎯 Quick Test Commands

**Test webhook manually** (before configuring ngrok):

```bash
curl -X POST http://localhost:3000/api/webhooks/livekit-egress \
  -H "Content-Type: application/json" \
  -d '{"egressInfo": {"egressId": "EG_test", "status": "EGRESS_STARTING"}}'
```

**Check database via Supabase**:

```sql
-- See all recordings
SELECT room_name, session_id, status, started_at
FROM session_recordings
ORDER BY started_at DESC;

-- See completed recordings with URLs
SELECT room_name, session_id, hls_playlist_url, duration_seconds
FROM session_recordings
WHERE status = 'COMPLETED';
```

**Happy testing!** 🚀
