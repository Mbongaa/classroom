# Step-by-Step Setup Instructions for bayaan-meets

**Project ID**: `bayaan-meets`
**Estimated Time**: 15-20 minutes

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- [ ] Windows PC with internet connection
- [ ] Google account (Gmail)
- [ ] Credit card for Google Cloud billing setup (won't be charged immediately)
- [ ] Admin rights on your PC (for installing gcloud CLI)

---

## 🚀 Step 1: Install Google Cloud CLI

### **1.1 Download the Installer**

Open your browser and go to:
```
https://cloud.google.com/sdk/docs/install#windows
```

Or download directly:
```
https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
```

### **1.2 Run the Installer**

1. Double-click `GoogleCloudSDKInstaller.exe`
2. Click **"Yes"** when Windows asks for permission
3. Select installation options:
   - ✅ Install for: **This user only** (or all users if you prefer)
   - ✅ Destination: Use default location (usually `C:\Users\HP\AppData\Local\Google\Cloud SDK`)
   - Click **"Install"**

4. Wait for installation (2-3 minutes)

5. When finished:
   - ⚠️ **UNCHECK** "Start Cloud SDK Shell"
   - ⚠️ **UNCHECK** "Run `gcloud init`"
   - Click **"Finish"**

### **1.3 Verify Installation**

1. Open a **NEW** Command Prompt (important - close old ones)
2. Run:
   ```cmd
   gcloud --version
   ```

**Expected Output**:
```
Google Cloud SDK 458.0.0
bq 2.0.101
core 2024.01.17
gcloud-crc32c 1.0.0
gsutil 5.27
```

✅ If you see version numbers, installation succeeded!
❌ If you see "not recognized", restart your PC and try again.

---

## 🔐 Step 2: Enable Billing (Required for Vertex AI)

### **2.1 Go to Billing Console**

Open: https://console.cloud.google.com/billing/linkedaccount?project=bayaan-meets

### **2.2 Link Billing Account**

1. If you see **"This project has no billing account"**:
   - Click **"Link a billing account"**

2. If you have an existing billing account:
   - Select it from the dropdown
   - Click **"Set account"**

3. If you DON'T have a billing account:
   - Click **"Create billing account"**
   - Enter your information:
     - Account name: `Bayaan Meets Billing`
     - Country: Select your country
     - Credit card details (for verification)
   - Click **"Submit and enable billing"**

**Note**: New accounts get **$300 free credit** for 90 days!

✅ Billing is now enabled for your project.

---

## ⚙️ Step 3: Run Automated Setup Script

Now we'll run the automated setup script I created for you.

### **3.1 Open Command Prompt**

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
```

### **3.2 Run Setup Script**

```cmd
setup-vertex-ai.cmd
```

This script will:
1. ✅ Check gcloud CLI installation
2. ✅ Set project to `bayaan-meets`
3. ✅ Enable Vertex AI API (takes 1-2 minutes)
4. ✅ Enable Generative Language API
5. ✅ Set up authentication (opens browser)
6. ✅ Update `.env` file with project ID
7. ✅ Install Python dependencies

### **3.3 What to Expect**

**When it reaches authentication**:
```
[Step 5/7] Setting up authentication...
This will open your browser for login...
Press any key to continue . . .
```

1. Press **Enter**
2. Your browser will open
3. Sign in with your Google account
4. Click **"Allow"** to grant permissions
5. You'll see: **"You are now authenticated with the gcloud CLI!"**
6. Return to Command Prompt - it should continue automatically

**Expected Output at the End**:
```
======================================
✅ Setup Complete!
======================================

Next steps:
1. Verify billing is enabled: https://console.cloud.google.com/billing...
2. Test the agent: python agent.py dev
```

---

## 🧪 Step 4: Test the Configuration

### **4.1 Test Config**

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
python test_config.py
```

**Expected Output**:
```
🔧 Agent Configuration:
  LiveKit URL: wss://jamaa-app-4bix2j1v...
  API Key: API3iYYRir...
  GCP Project: bayaan-meets
  GCP Location: us-central1
  Agent Identity: voice-segmenter
  Output Directory: segments
  Save Audio: True
  Save Translations: False
  Log Level: INFO
✅ Configuration validated
```

✅ If you see this, configuration is correct!

### **4.2 Test Translator (Optional)**

Create a test file:
```cmd
echo import asyncio > test_translator.py
echo from translator import GeminiTranslator >> test_translator.py
echo. >> test_translator.py
echo async def test(): >> test_translator.py
echo     translator = GeminiTranslator(project_id='bayaan-meets', location='us-central1') >> test_translator.py
echo     print('✅ Translator initialized successfully!') >> test_translator.py
echo     print(f'Model: {translator.model_name}') >> test_translator.py
echo. >> test_translator.py
echo asyncio.run(test()) >> test_translator.py
```

Run it:
```cmd
python test_translator.py
```

**Expected Output**:
```
✅ Gemini translator initialized via Vertex AI (project: bayaan-meets, location: us-central1, model: gemini-2.5-flash)
✅ Translator initialized successfully!
Model: gemini-2.5-flash
```

---

## 🎯 Step 5: Run the Agent

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
venv\Scripts\activate
python agent.py dev
```

**Expected Output**:
```
[2025-10-10 14:30:00] [INFO] 🚀 Starting Voice Segmenter Agent
[2025-10-10 14:30:00] [INFO] 🔥 Prewarming agent...
[2025-10-10 14:30:00] [INFO] ✅ Configuration validated
[2025-10-10 14:30:01] [INFO] 🧠 Loading Silero VAD model...
[2025-10-10 14:30:02] [INFO] ✅ Silero VAD model loaded successfully
[2025-10-10 14:30:02] [INFO] ✅ Vertex AI translator initialized
[2025-10-10 14:30:02] [INFO] ✅ Audio processor config prepared
[2025-10-10 14:30:02] [INFO] ✅ Agent prewarmed successfully
[2025-10-10 14:30:02] [INFO] 📡 Agent is ready and waiting for rooms...
```

✅ **Success!** Your agent is now running with Vertex AI!

---

## 🔍 Troubleshooting

### Problem: "gcloud: command not found"

**Solution**:
1. Restart your Command Prompt
2. If still not working, add to PATH manually:
   - Search Windows for "Environment Variables"
   - Edit "Path" variable
   - Add: `C:\Users\HP\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`
   - Restart Command Prompt

### Problem: "The service aiplatform.googleapis.com is not enabled"

**Solution**:
```cmd
gcloud services enable aiplatform.googleapis.com --project=bayaan-meets
```

Wait 1-2 minutes, then try again.

### Problem: "This API method requires billing to be enabled"

**Solution**:
1. Go to: https://console.cloud.google.com/billing/linkedaccount?project=bayaan-meets
2. Click "Link a billing account"
3. Follow Step 2 above

### Problem: "Permission denied" or "403"

**Solution**:
```cmd
gcloud projects add-iam-policy-binding bayaan-meets ^
  --member="user:YOUR-EMAIL@gmail.com" ^
  --role="roles/aiplatform.user"
```

Replace `YOUR-EMAIL@gmail.com` with your Google account email.

### Problem: "Could not authenticate"

**Solution**:
```cmd
gcloud auth application-default revoke
gcloud auth application-default login
```

---

## 📊 Verify Everything Works

### Check Project Settings

```cmd
gcloud config list
```

**Expected**:
```
[core]
project = bayaan-meets
account = your-email@gmail.com
```

### Check Enabled APIs

```cmd
gcloud services list --enabled --project=bayaan-meets | findstr aiplatform
```

**Expected**:
```
aiplatform.googleapis.com         Vertex AI API
```

### Check Authentication

```cmd
gcloud auth application-default print-access-token
```

**Expected**: A long token string (means authentication works)

---

## ✅ Final Checklist

Before running your agent in production, verify:

- [ ] Google Cloud CLI installed and working
- [ ] Project `bayaan-meets` created
- [ ] Billing enabled with credit card linked
- [ ] Vertex AI API enabled
- [ ] Authentication successful (gcloud auth)
- [ ] `.env` file has `GOOGLE_CLOUD_PROJECT=bayaan-meets`
- [ ] Python dependencies installed (`google-genai`, `google-auth`)
- [ ] `test_config.py` passes
- [ ] Agent starts without errors

---

## 💰 Monitor Your Usage

Keep track of costs:
1. Go to: https://console.cloud.google.com/billing/linkedaccount?project=bayaan-meets
2. Click on your billing account
3. View "Reports" to see spending

**Free tier**: You have $300 credit for 90 days!

**Typical usage** (audio transcription + translation):
- ~$0.15 per hour of audio
- Very affordable for testing and moderate production use

---

## 📞 Need Help?

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review logs in Command Prompt
3. Check Google Cloud Console: https://console.cloud.google.com/
4. Read full migration guide: `VERTEX_AI_MIGRATION_GUIDE.md`

---

**Setup Date**: 2025-10-10
**Project**: bayaan-meets
**Region**: us-central1
