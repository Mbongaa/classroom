# 🌐 Cloudflare R2 Public Access Setup

## ❗ Why This Is Needed

Your recordings are saved to R2, but **videos won't play** because:

- ❌ Current: Using private R2 endpoint (requires authentication)
- ✅ Needed: Public URL so browsers can access videos

---

## 🚀 Quick Setup (5 minutes)

### **Step 1: Enable Public Access on R2 Bucket**

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **R2 Object Storage**
3. Click on your bucket: **livekit-recordings**
4. Click **"Settings"** tab
5. Scroll to **"Public Access"** section
6. Click **"Allow Access"**
7. Cloudflare will generate a public domain: `https://pub-xxxxx.r2.dev`
8. **Copy this URL** (e.g., `https://pub-abc123def456.r2.dev`)

---

### **Step 2: Add to .env.local**

Open `.env.local` and add the public domain:

```bash
# R2 Public Domain (Required for video playback)
R2_PUBLIC_DOMAIN=https://pub-abc123def456.r2.dev
```

**Replace** `https://pub-abc123def456.r2.dev` with YOUR actual R2 public domain from Step 1.

---

### **Step 3: Restart Server**

```bash
# Stop server (Ctrl+C)
pnpm dev
```

---

### **Step 4: Test**

1. Record a new test session
2. Wait for completion (60 seconds)
3. Check database - `hls_playlist_url` should now be:
   ```
   https://pub-xxxxx.r2.dev/s7sy-uw2h/s7sy-uw2h_2025-10-03_16-58/index.m3u8
   ```
4. Try opening URL in browser - should show HLS playlist
5. Go to `/dashboard/recordings` and click "Watch"
6. **Video should play!** ✅

---

## 🎯 Alternative: Custom Domain (Production)

For production, use a custom domain instead of r2.dev:

1. **In R2 Dashboard**:
   - Settings → Public Access
   - Click "Connect Domain"
   - Enter: `recordings.yourdomain.com`

2. **Add DNS Record** (in Cloudflare DNS):
   - Type: CNAME
   - Name: `recordings`
   - Target: `[your-bucket].r2.cloudflarestorage.com`

3. **Update .env.local**:
   ```bash
   R2_PUBLIC_DOMAIN=https://recordings.yourdomain.com
   ```

---

## 🔒 Security Note

**Public bucket means**:

- ✅ Anyone with URL can watch videos
- ✅ Videos are NOT listed publicly (need exact URL)
- ⚠️ For private recordings, use signed URLs (Phase 2 feature)

---

## ✅ All Fixes Summary

After setup:

- ✅ Issue 1 (URLs): Fixed with public domain
- ✅ Issue 2 (room_sid): Fixed with null check
- ✅ Issue 3 (duration): Fixed with timestamp fallback

**You're ready to test the complete flow!** 🎉
