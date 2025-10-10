# Render Deployment Guide - Voice Segmenter Agent

**Platform**: Render.com
**Service Type**: Background Worker (Persistent Service)
**Project**: bayaan-meets

---

## ✅ Pre-Deployment Checklist

- [x] Agent tested locally and working
- [x] Vertex AI configured with `bayaan-meets` project
- [x] Service account JSON key created
- [x] Dockerfile created
- [x] render.yaml created
- [x] .dockerignore created
- [ ] Git repository ready (push agent code)
- [ ] Render account created
- [ ] Environment variables configured

---

## 📂 Required Files (Already Created)

```
voice-segmenter/
├── Dockerfile                           ✅ Container definition
├── render.yaml                          ✅ Render configuration
├── .dockerignore                        ✅ Exclude files from build
├── .python-version                      ✅ Python 3.10
├── requirements.txt                     ✅ Dependencies
├── agent.py                             ✅ Main entry point
├── audio_processor.py                   ✅ Core logic
├── translator.py                        ✅ Vertex AI translator
├── config.py                            ✅ Configuration
├── bayaan-meets-36b41e23f9cc.json      ✅ Service account key
└── .gitignore                          ✅ Protect secrets
```

---

## 🚀 Deployment Steps

### **Step 1: Prepare Git Repository**

#### **Option A: Separate Repository (Recommended)**

```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

# Initialize git
git init
git add .
git commit -m "Initial commit: Voice Segmenter Agent for Vertex AI"

# Create GitHub repo (via GitHub website)
# Then push:
git remote add origin https://github.com/YOUR-USERNAME/voice-segmenter-agent.git
git branch -M main
git push -u origin main
```

#### **Option B: Subdirectory in Existing Repo**

```bash
cd C:\Users\HP\Desktop\meet

# Add voice-segmenter to your existing repo
git add agents/voice-segmenter/
git commit -m "Add voice segmenter agent with Vertex AI"
git push
```

**IMPORTANT**: Verify `.gitignore` is protecting your service account JSON!

```bash
git status
# Should NOT show: bayaan-meets-36b41e23f9cc.json
```

---

### **Step 2: Create Render Service**

1. **Go to Render Dashboard**: https://dashboard.render.com/

2. **Click "New +"** → **"Background Worker"**

3. **Connect Repository**:
   - Select your GitHub repository
   - If using subdirectory: Set **Root Directory** to `agents/voice-segmenter`

4. **Configure Service**:
   - **Name**: `voice-segmenter-agent`
   - **Region**: **Oregon** (closest to Europe)
   - **Branch**: `main`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `./Dockerfile` (auto-detected)
   - **Docker Build Context**: `.` (auto-detected)

5. **Select Plan**:
   - **Starter**: $7/month (512MB RAM, 0.5 CPU) ← Recommended
   - **Standard**: $25/month (2GB RAM, 1 CPU) ← If you need more power

---

### **Step 3: Configure Environment Variables**

In Render dashboard, add these **Environment Variables**:

#### **LiveKit Credentials** (from your .env):
```
LIVEKIT_URL = wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY = API3iYYRirpXUmf
LIVEKIT_API_SECRET = xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C
```

#### **Vertex AI Configuration**:
```
GOOGLE_CLOUD_PROJECT = bayaan-meets
GOOGLE_CLOUD_LOCATION = europe-west1
GOOGLE_APPLICATION_CREDENTIALS = bayaan-meets-36b41e23f9cc.json
```

#### **Translation Settings**:
```
TRANSLATION_CONTEXT_ENABLED = true
TRANSLATION_CONTEXT_WINDOW = 10
OUTPUT_DIR = segments
SAVE_AUDIO = true
SAVE_TRANSLATIONS = false
LOG_LEVEL = INFO
```

---

### **Step 4: Add Service Account Secret File** ⚠️ **CRITICAL**

**BEFORE deploying**, you MUST add the service account JSON as a Secret File:

1. **In Render Dashboard** (while creating the service):
   - Scroll down to **"Secret Files"** section
   - Click **"Add Secret File"**

2. **Configure the secret file**:
   - **Filename**: `bayaan-meets-36b41e23f9cc.json`
   - **Contents**: Open your local `bayaan-meets-36b41e23f9cc.json` file and paste the entire JSON content
   - Click **"Save"**

3. **Render will mount this file** at runtime:
   - Path: `/home/appuser/agent/bayaan-meets-36b41e23f9cc.json`
   - Agent reads it via `GOOGLE_APPLICATION_CREDENTIALS` env var

**Why this is required**:
- ✅ JSON file is NOT in Git repo (protected by .gitignore - good!)
- ✅ Dockerfile does NOT copy it (secure!)
- ✅ Render provides it at runtime via Secret Files

---

### **Step 5: Deploy**

1. **Click "Create Background Worker"**
2. Render will:
   - Pull your code from GitHub
   - Build Docker image (without JSON file)
   - Mount Secret File at runtime
   - Start the agent
3. **Monitor Logs**:
   - Click on your service → **"Logs"** tab
   - Look for: `✅ Agent prewarmed successfully`

---

### **Step 6: Verify Deployment**

#### **Check Logs**:

Look for these success indicators:
```
🚀 Starting Voice Segmenter Agent
✅ Configuration validated
✅ Silero VAD model loaded successfully
✅ Gemini translator initialized via Vertex AI (project: bayaan-meets, location: europe-west1)
🧠 Conversation memory: ENABLED (window: 10 segments)
✅ Agent prewarmed successfully
registered worker {"url": "wss://jamaa-app-4bix2j1v.livekit.cloud", "region": "UAE"}
```

#### **Test with LiveKit**:
1. Join a classroom as teacher
2. Speak some Arabic
3. Check student sees translations
4. Verify in Render logs: `✅ Translation completed via Vertex AI`

---

## 🔐 Security: Service Account Key Handling

### **Current Setup** (Dockerfile copies JSON):
```dockerfile
COPY bayaan-meets-36b41e23f9cc.json .
```

**Pros**: Simple, works immediately
**Cons**: JSON key is baked into Docker image

### **More Secure Option: Render Secret Files**

1. **In Render Dashboard**:
   - Go to your service → **"Secret Files"**
   - Click **"Add Secret File"**
   - **Filename**: `bayaan-meets-36b41e23f9cc.json`
   - **Contents**: Paste your JSON key content
   - **Mount Path**: `/home/appuser/agent/bayaan-meets-36b41e23f9cc.json`

2. **Update Dockerfile** (remove COPY line):
   ```dockerfile
   # COPY bayaan-meets-36b41e23f9cc.json .  ← Comment this out
   ```

3. **Render will mount the file** at runtime (not in image)

**Recommendation**: Use Secret Files for production!

---

## 🔄 Auto-Deployment Workflow

Once set up, deployment is automatic:

```bash
# Make changes to your agent
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
# Edit files...

# Commit and push
git add .
git commit -m "Update translator logic"
git push

# Render automatically:
# 1. Detects push
# 2. Builds new Docker image
# 3. Deploys with zero-downtime
# 4. Old instance continues until new one is ready
```

---

## 📊 Monitoring & Management

### **View Logs**:
```
Render Dashboard → voice-segmenter-agent → Logs tab
```

### **Restart Service**:
```
Render Dashboard → voice-segmenter-agent → Manual Deploy → "Clear build cache & deploy"
```

### **Check Metrics**:
```
Render Dashboard → voice-segmenter-agent → Metrics tab
```
- CPU usage
- Memory usage
- Restart count

---

## 💰 Cost Breakdown

### **Render Costs**:
- **Starter Plan**: $7/month (always-on worker)
- **Bandwidth**: Included (100GB/month)
- **Build minutes**: Included

### **Google Cloud Costs**:
- **Vertex AI**: ~$0.30/hour of translation
- **24/7 usage**: ~$216/month
- **Moderate usage** (4 hours/day): ~$36/month

### **Total Estimated Cost**:
- **Light usage** (2 hours/day): ~$7 + $18 = **$25/month**
- **Moderate usage** (4 hours/day): ~$7 + $36 = **$43/month**
- **Heavy usage** (8 hours/day): ~$7 + $72 = **$79/month**

---

## 🔍 Troubleshooting

### **Build Fails**:

**Check**:
- All required files committed to Git
- Dockerfile syntax is correct
- requirements.txt has all dependencies

**Solution**:
```bash
# Test Docker build locally first
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
docker build -t voice-segmenter-test .
```

### **Agent Doesn't Start**:

**Check Logs** for errors:
- Missing environment variables
- Service account authentication failed
- LiveKit connection issues

**Common Fixes**:
- Verify all env vars are set in Render dashboard
- Check service account JSON is valid
- Verify LiveKit credentials

### **No Translations Appearing**:

**Check**:
1. Agent logs show: `✅ Translation completed via Vertex AI`
2. Student has selected a language in UI
3. Teacher's audio is being detected

**Debug**:
```
# In Render logs, look for:
🎤 Teacher audio track detected
🌐 Processing audio with Gemini
✅ Translation completed via Vertex AI
```

### **High Costs**:

**Solutions**:
- Reduce `TRANSLATION_CONTEXT_WINDOW` from 10 to 5
- Set `TRANSLATION_CONTEXT_ENABLED=false` (saves 50% on Vertex AI)
- Monitor usage in Google Cloud Console

---

## 🎯 Production Checklist

Before going live:

- [ ] Test agent locally with multiple students
- [ ] Verify custom translation prompts work
- [ ] Test conversation memory (connected speech)
- [ ] Check Vertex AI quota limits
- [ ] Set up billing alerts in Google Cloud
- [ ] Configure Render notifications (Slack/email)
- [ ] Test graceful shutdown (stop agent while in session)
- [ ] Backup service account key securely
- [ ] Document deployment process for team
- [ ] Set up monitoring dashboards

---

## 📚 Useful Commands

### **Render CLI** (Optional):

```bash
# Install Render CLI
npm install -g @render-tools/cli

# Deploy from command line
render deploy

# View logs
render logs voice-segmenter-agent

# SSH into container (for debugging)
render ssh voice-segmenter-agent
```

### **Docker Testing** (Local):

```bash
# Build image
docker build -t voice-segmenter .

# Test run locally
docker run --env-file .env voice-segmenter

# Check image size
docker images voice-segmenter
```

---

## 🔗 Important Links

- **Render Dashboard**: https://dashboard.render.com/
- **Your Service** (after deployment): https://dashboard.render.com/pserv/YOUR-SERVICE-ID
- **Render Docs**: https://render.com/docs/background-workers
- **LiveKit Agent Docs**: https://docs.livekit.io/agents/ops/deployment/
- **Vertex AI Console**: https://console.cloud.google.com/vertex-ai?project=bayaan-meets
- **Billing**: https://console.cloud.google.com/billing/linkedaccount?project=bayaan-meets

---

## 📞 Support

**Render Support**: https://render.com/docs/support
**LiveKit Community**: https://livekit.io/discord
**Vertex AI Support**: https://cloud.google.com/support

---

**Deployment Date**: 2025-10-10
**Agent Version**: v1.0 (Vertex AI with conversation memory)
**Platform**: Render Background Worker
**Region**: Oregon → Vertex AI europe-west1
