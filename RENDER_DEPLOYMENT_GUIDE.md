# Render Deployment Guide for LiveKit Meet

## 🚀 Quick Deploy Steps

### 1. Push render.yaml to GitHub
```bash
git add render.yaml
git commit -m "Add Render deployment configuration"
git push
```

### 2. Deploy via Render Dashboard

**Option A: Blueprint (Recommended)**
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **Blueprints** → **New Blueprint Instance**
3. Select your GitHub repository
4. Name your blueprint project (e.g., "livekit-meet-prod")
5. Click **Apply**

**Option B: Manual Web Service**
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: livekit-meet
   - **Language**: Node
   - **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
   - **Start Command**: `pnpm start`

### 3. Set Environment Variables

**CRITICAL** - After deployment, set these in Render Dashboard:

Go to: **Your Service** → **Environment** → Add variables:

```bash
# REQUIRED - Get from LiveKit Cloud Dashboard
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_URL=wss://your-project.livekit.cloud
```

**Optional** (for additional features):
- S3/R2 credentials (for recording)
- Supabase credentials (for persistent rooms)
- Gemini API key (for translation)

---

## 🐛 White Screen Troubleshooting

### Diagnostic Steps

#### 1. Check Build Logs
In Render Dashboard → **Your Service** → **Logs** → Look for:
- ❌ Build errors
- ❌ Module not found errors
- ❌ Out of memory errors
- ✅ "Your service is live 🎉"

#### 2. Check Browser Console
Open deployed site → Right-click → **Inspect** → **Console** tab:

**Common errors:**

```javascript
// Missing environment variables
"LIVEKIT_URL is not defined"
→ Fix: Set LIVEKIT_URL in Render dashboard

// JavaScript errors
"Uncaught TypeError: Cannot read properties of undefined"
→ Check if all dependencies installed correctly

// Network errors
"Failed to load resource: net::ERR_BLOCKED_BY_CLIENT"
→ Check browser extensions (ad blockers)

// Service Worker errors (PWA)
"Service worker registration failed"
→ See PWA troubleshooting below
```

#### 3. Check Network Tab
Browser → **Inspect** → **Network** tab → Refresh page:
- ✅ HTML file loads (status 200)
- ✅ JavaScript bundles load (_next/static/chunks/*)
- ❌ If 404 errors: Build output issue

#### 4. Check Runtime Logs
Render Dashboard → **Your Service** → **Logs** → **Runtime**:
```bash
# Should see:
> livekit-meet@0.2.0 start
> next start

- info  Listening on port 3000

# If you see errors about missing env vars, set them in dashboard
```

---

## 🔧 Common White Screen Fixes

### Fix #1: Missing Environment Variables

**Symptom**: White screen, console shows "undefined" errors

**Solution**:
1. Render Dashboard → **Your Service** → **Environment**
2. Add **minimum required** variables:
   ```bash
   LIVEKIT_API_KEY=your_key
   LIVEKIT_API_SECRET=your_secret
   LIVEKIT_URL=wss://your-project.livekit.cloud
   NODE_ENV=production
   ```
3. Click **Save Changes** (triggers auto-redeploy)

### Fix #2: PWA Service Worker Cache

**Symptom**: White screen on subsequent visits, works in incognito

**Solution**:
1. Clear service worker cache:
   - Browser → **Inspect** → **Application** tab
   - **Service Workers** → Click **Unregister**
   - **Storage** → **Clear site data**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

2. Or disable PWA temporarily:
   ```bash
   # In Render environment variables, add:
   NODE_ENV=development  # Disables PWA
   ```
   (Not recommended for production)

### Fix #3: Build Output Issues

**Symptom**: White screen, network tab shows 404 for JS files

**Solution**:
1. Check build completed successfully:
   ```bash
   # In Render Logs, look for:
   > Creating an optimized production build
   > Compiled successfully
   ```

2. Verify build command uses production mode:
   ```bash
   # In render.yaml or dashboard:
   buildCommand: pnpm install --frozen-lockfile && pnpm build
   ```

3. **Force rebuild**:
   - Render Dashboard → **Manual Deploy** → **Clear build cache & deploy**

### Fix #4: Next.js Configuration Issues

**Symptom**: White screen, no obvious errors

**Solution**:

Check `next.config.js` doesn't have incompatible settings:

```javascript
// ❌ WRONG for Render (static export)
module.exports = {
  output: 'export',  // Remove this!
}

// ✅ CORRECT for Render (Node.js server)
module.exports = {
  // No output field, or:
  output: 'standalone', // Optional, for Docker
}
```

Your current config is **correct** - uses Node.js server mode.

### Fix #5: Memory Issues During Build

**Symptom**: Build fails with "Killed" or heap out of memory

**Solution**:
1. Increase Node memory in render.yaml:
   ```yaml
   envVars:
     - key: NODE_OPTIONS
       value: "--max-old-space-size=4096"
   ```

2. Or upgrade to higher Render plan (more RAM)

### Fix #6: Port Configuration

**Symptom**: Service shows "live" but doesn't respond

**Solution**:
Next.js automatically uses Render's `$PORT` env var ✅
But if you have custom server, ensure:

```javascript
// server.js
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on port ${port}`));
```

---

## 🧪 Test Deployment Locally

Before deploying, test production build locally:

```bash
# 1. Install dependencies
pnpm install

# 2. Build for production
pnpm build

# 3. Start production server
pnpm start

# 4. Test in browser
# Open http://localhost:3000
# Check browser console for errors
```

If it works locally but not on Render:
- Compare local `.env.local` with Render environment variables
- Check Node.js version matches: `node --version` (should be 18+)

---

## 📋 Deployment Checklist

Before deploying:
- [ ] `render.yaml` exists in project root
- [ ] Committed and pushed to GitHub
- [ ] LiveKit credentials ready
- [ ] Tested `pnpm build` locally without errors
- [ ] Tested `pnpm start` locally and site works
- [ ] `.gitignore` excludes `.env.local` ✅
- [ ] Browser console shows no errors locally

After deploying:
- [ ] Set environment variables in Render dashboard
- [ ] Check build logs for errors
- [ ] Test deployed URL in browser
- [ ] Check browser console for errors
- [ ] Test video room creation
- [ ] Test WebRTC connection (camera/mic)

---

## 🆘 Still Having Issues?

### Enable Debug Logging

Add to Render environment variables:
```bash
DEBUG=livekit*
NEXT_PUBLIC_LOG_LEVEL=debug
```

### Check Service Health

```bash
# Test if service responds
curl https://your-app.onrender.com/

# Should return HTML
```

### Compare with Working Vercel Deployment

If it works on Vercel but not Render:
1. Check Vercel environment variables → Copy to Render
2. Check Vercel build logs → Compare with Render logs
3. Check Vercel runtime version → Match in Render

### Get Help

- **Render Discord**: https://render.com/discord
- **LiveKit Discord**: https://livekit.io/discord
- **GitHub Issues**: Open issue in your repo with:
  - Render build logs (redact secrets)
  - Browser console errors
  - Network tab screenshot

---

## 🎯 Production Checklist

Once working:
- [ ] Upgrade from Free to Starter plan ($7/mo) for no spin-down
- [ ] Configure custom domain
- [ ] Enable HTTPS (automatic on Render)
- [ ] Set up health checks
- [ ] Configure monitoring (Datadog optional)
- [ ] Test with multiple participants
- [ ] Load test with expected user count
- [ ] Document LiveKit room limits for your plan

---

## 📖 Additional Resources

- [Render Next.js Docs](https://render.com/docs/deploy-nextjs-app)
- [LiveKit Server SDK Docs](https://docs.livekit.io/reference/server-sdks/)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [PWA Troubleshooting](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
