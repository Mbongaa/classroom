# Render Deployment - Quick Start Guide

**Your agent is ready to deploy!** Follow these steps:

---

## ✅ Pre-Deployment Verification

### **1. Check Git Status**

```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
git status
```

**Should see**:
- ✅ Dockerfile, render.yaml, requirements.txt (tracked)
- ❌ **NOT** bayaan-meets-36b41e23f9cc.json (protected by .gitignore)

If you see the JSON file, **STOP** - it's not protected!

---

## 🚀 Deployment Steps (5 Minutes)

### **Step 1: Push to GitHub**

Your repo: https://github.com/Mbongaa/voice-segmenter

```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
git add .
git commit -m "Ready for Render deployment with Vertex AI"
git push
```

---

### **Step 2: Create Render Service**

1. Go to: https://dashboard.render.com/
2. Click **"New +"** → **"Background Worker"**
3. Connect repository: **Mbongaa/voice-segmenter**
4. Configure:
   - **Name**: `voice-segmenter-agent`
   - **Region**: **Oregon**
   - **Runtime**: **Docker**
   - **Plan**: **Starter** ($7/month)

---

### **Step 3: Add Environment Variables**

In the "Environment Variables" section, add:

```
LIVEKIT_URL = wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY = API3iYYRirpXUmf
LIVEKIT_API_SECRET = xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C
GOOGLE_CLOUD_PROJECT = bayaan-meets
GOOGLE_CLOUD_LOCATION = europe-west1
GOOGLE_APPLICATION_CREDENTIALS = bayaan-meets-36b41e23f9cc.json
TRANSLATION_CONTEXT_ENABLED = true
TRANSLATION_CONTEXT_WINDOW = 10
LOG_LEVEL = INFO
```

---

### **Step 4: Add Service Account Secret File** ⚠️ **CRITICAL**

Still in the Render service creation screen:

1. Scroll to **"Secret Files"** section
2. Click **"Add Secret File"**
3. Fill in:
   - **Filename**: `bayaan-meets-36b41e23f9cc.json`
   - **Contents**:
     - Open your local file: `C:\Users\HP\Desktop\meet\agents\voice-segmenter\bayaan-meets-36b41e23f9cc.json`
     - Copy **ALL** the JSON content
     - Paste into Render

**Example JSON structure** (yours will look like this):
```json
{
  "type": "service_account",
  "project_id": "bayaan-meets",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "vertex-ai-agent@bayaan-meets.iam.gserviceaccount.com",
  ...
}
```

4. Click **"Save"**

---

### **Step 5: Deploy**

1. Click **"Create Background Worker"**
2. Wait for build (2-3 minutes)
3. Watch logs for: `✅ Agent prewarmed successfully`

---

## ✅ Success Indicators

### **In Render Logs**:
```
[INFO] 🚀 Starting Voice Segmenter Agent
[INFO] ✅ Configuration validated
[INFO] ✅ Silero VAD model loaded successfully
[INFO] ✅ Gemini translator initialized via Vertex AI (project: bayaan-meets, location: europe-west1, model: gemini-2.5-flash)
[INFO] 🧠 Conversation memory: ENABLED (window: 10 segments)
[INFO] ✅ Vertex AI translator initialized
[INFO] ✅ Agent prewarmed successfully
[INFO] registered worker {"url": "wss://jamaa-app-4bix2j1v.livekit.cloud"}
```

---

## 🧪 Test After Deployment

1. **Join classroom as teacher**
2. **Set language to Arabic**
3. **Speak**: "السلام عليكم ورحمة الله"
4. **Student should see**: "Peace be upon you and the mercy of Allah"
5. **Check Render logs**: `✅ Translation completed via Vertex AI`

---

## 🚨 Common Issues

### **Issue**: "COPY failed: bayaan-meets-36b41e23f9cc.json not found"
**Solution**: You forgot Step 4 - add Secret File BEFORE deploying

### **Issue**: "DefaultCredentialsError: credentials not found"
**Solution**: Secret File not properly configured in Render

### **Issue**: "404 model not found me-west1"
**Solution**: Already fixed - using `europe-west1` ✅

---

## 💰 Monthly Cost

- **Render**: $7/month
- **Vertex AI**: Depends on usage
  - 2 hours/day: ~$18/month
  - 4 hours/day: ~$36/month
  - 8 hours/day: ~$72/month

**Total**: **$25-79/month**

---

## 🔗 Quick Links

- **Your GitHub Repo**: https://github.com/Mbongaa/voice-segmenter
- **Render Dashboard**: https://dashboard.render.com/
- **Vertex AI Console**: https://console.cloud.google.com/vertex-ai?project=bayaan-meets
- **Full Guide**: See `DEPLOYMENT.md`

---

**Ready to deploy? Follow the 5 steps above!** 🚀
