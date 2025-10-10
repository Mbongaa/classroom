# Vertex AI Migration Guide

**Status**: ✅ Code migration complete | ⚙️ Setup required

This guide walks you through completing the migration from Google AI Studio to Vertex AI.

---

## 📊 What Changed

### Files Modified
1. **`requirements.txt`** - Updated SDK dependencies
2. **`translator.py`** - New unified SDK with Vertex AI client
3. **`config.py`** - Added Vertex AI environment variables
4. **`agent.py`** - Updated translator initialization
5. **`.env`** - Vertex AI configuration (requires your project ID)

### Key Differences

| Aspect | AI Studio (Old) | Vertex AI (New) |
|--------|-----------------|-----------------|
| **SDK** | `google-generativeai` | `google-genai` (unified) |
| **Authentication** | API Key | Service Account / ADC |
| **Model** | `gemini-2.5-flash` | `gemini-2.5-flash` (same!) |
| **Quotas** | Free tier, limited | Pay-as-you-go, higher |

---

## 🚀 Setup Steps

### Step 1: Google Cloud Project Setup

**1.1 Create or Select Project**

```bash
# Create new project (or use existing)
gcloud projects create your-project-id --name="Voice Segmenter Project"

# Set as default
gcloud config set project your-project-id
```

**1.2 Enable Vertex AI API**

```bash
# Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable generativelanguage.googleapis.com
```

**1.3 Set Up Billing**

- Go to: https://console.cloud.google.com/billing
- Link a billing account to your project
- Vertex AI requires billing enabled (pay-as-you-go)

---

### Step 2: Authentication Setup

Choose **ONE** of the following methods:

#### **Option A: Application Default Credentials (Development)**

Best for: Local development, testing

```bash
# Install Google Cloud CLI if not already installed
# Windows: https://cloud.google.com/sdk/docs/install#windows
# macOS: brew install google-cloud-sdk
# Linux: https://cloud.google.com/sdk/docs/install#linux

# Authenticate
gcloud auth application-default login

# This will open a browser window for authentication
# After success, credentials are saved locally
```

**Pros**: Easy setup, no key files to manage
**Cons**: User-specific, not suitable for production

#### **Option B: Service Account (Production)**

Best for: Production deployments, CI/CD

```bash
# Create service account
gcloud iam service-accounts create vertex-ai-agent \
    --display-name="Voice Segmenter Agent"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:vertex-ai-agent@your-project-id.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Download key file
gcloud iam service-accounts keys create vertex-ai-key.json \
    --iam-account=vertex-ai-agent@your-project-id.iam.gserviceaccount.com

# Set environment variable (add to .env or shell profile)
export GOOGLE_APPLICATION_CREDENTIALS="C:\Users\HP\Desktop\meet\agents\voice-segmenter\vertex-ai-key.json"
```

**Security Note**: Keep `vertex-ai-key.json` secure. Add to `.gitignore`!

**Pros**: Production-ready, can be automated
**Cons**: Requires key file management

---

### Step 3: Update Configuration

**3.1 Edit `.env` file**

```bash
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter
```

Open `.env` and replace `your-project-id` with your actual project ID:

```env
# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=your-actual-project-id  # ← CHANGE THIS
GOOGLE_CLOUD_LOCATION=us-central1             # ← Or your preferred region
```

**Available Regions**:
- `us-central1` (Iowa) - Recommended
- `us-east1` (South Carolina)
- `europe-west1` (Belgium)
- `asia-southeast1` (Singapore)
- Full list: https://cloud.google.com/vertex-ai/docs/general/locations

---

### Step 4: Install Dependencies

```cmd
cd C:\Users\HP\Desktop\meet\agents\voice-segmenter

rem Activate virtual environment
venv\Scripts\activate

rem Install new dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

**What's installed**:
- `google-genai` - New unified SDK for Gemini
- `google-auth` - Authentication library

---

### Step 5: Test the Setup

**5.1 Test Configuration**

```cmd
venv\Scripts\activate
python test_config.py
```

Expected output:
```
🔧 Agent Configuration:
  LiveKit URL: wss://jamaa-app-4bix2j1v...
  API Key: API3iYYRir...
  GCP Project: your-project-id
  GCP Location: us-central1
  Agent Identity: voice-segmenter
  ...
✅ Configuration validated
```

**5.2 Test Translator (Optional)**

Create `test_translator.py`:

```python
import asyncio
from translator import GeminiTranslator

async def test():
    translator = GeminiTranslator(
        project_id='your-project-id',
        location='us-central1'
    )
    print('✅ Translator initialized successfully!')
    print(f'Model: {translator.model_name}')
    print(f'Client: {translator.client}')

asyncio.run(test())
```

Run:
```cmd
venv\Scripts\activate
python test_translator.py
```

**5.3 Run Agent**

```cmd
venv\Scripts\activate
python agent.py dev
```

Look for:
```
✅ Vertex AI translator initialized
🚀 Agent starting for room: ...
```

---

## 🎯 Quick Reference

### Environment Variables

```env
# Required
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Optional (if using service account)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### Authentication Commands

```bash
# Check current authentication
gcloud auth list

# Re-authenticate (development)
gcloud auth application-default login

# Revoke authentication
gcloud auth application-default revoke
```

### Troubleshooting Commands

```bash
# Check if APIs are enabled
gcloud services list --enabled | findstr aiplatform

# Test API access
gcloud ai models list --region=us-central1

# Check current project
gcloud config get-value project

# View service account keys
gcloud iam service-accounts keys list \
    --iam-account=vertex-ai-agent@your-project-id.iam.gserviceaccount.com
```

---

## 🔍 Troubleshooting

### Error: "GOOGLE_CLOUD_PROJECT not set"

**Solution**: Update `.env` file with your project ID:
```env
GOOGLE_CLOUD_PROJECT=your-actual-project-id
```

### Error: "Could not automatically determine credentials"

**Solution**: Run authentication setup:
```bash
gcloud auth application-default login
```

### Error: "Permission denied" or "403 Forbidden"

**Solution**: Grant Vertex AI User role:
```bash
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:your-email@example.com" \
    --role="roles/aiplatform.user"
```

### Error: "The service aiplatform.googleapis.com is not enabled"

**Solution**: Enable the API:
```bash
gcloud services enable aiplatform.googleapis.com
```

### Error: "This API method requires billing to be enabled"

**Solution**: Enable billing at https://console.cloud.google.com/billing

### Import Error: "No module named 'google.genai'"

**Solution**: Reinstall dependencies:
```cmd
venv\Scripts\activate
pip install --upgrade google-genai google-auth
```

---

## 💰 Cost Estimation

Vertex AI uses pay-as-you-go pricing:

**Gemini 2.5 Flash Pricing** (as of 2025):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- Audio: $0.05 per minute

**Example Usage**:
- 1 hour of audio processing
- Average 5-second speech segments = 720 segments
- ~500 tokens per translation × 720 = 360K tokens
- **Estimated cost**: ~$0.15/hour

**Free Tier**: New Google Cloud accounts get $300 credit (90 days)

**Monitor Usage**: https://console.cloud.google.com/billing

---

## 📚 Additional Resources

- **Vertex AI Documentation**: https://cloud.google.com/vertex-ai/docs
- **Google Gen AI SDK**: https://googleapis.github.io/python-genai/
- **Gemini Models**: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini
- **Authentication Guide**: https://cloud.google.com/docs/authentication
- **Pricing Calculator**: https://cloud.google.com/products/calculator

---

## ✅ Migration Checklist

- [ ] Google Cloud project created
- [ ] Vertex AI API enabled
- [ ] Billing account linked
- [ ] Authentication configured (ADC or service account)
- [ ] `.env` file updated with project ID
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Configuration tested (`python test_config.py`)
- [ ] Agent tested (`python agent.py dev`)
- [ ] Service account key secured (if using)
- [ ] Old API key removed/disabled

---

## 🔄 Rollback Instructions

If you need to revert to AI Studio:

1. **Restore old files** (if you have Git):
   ```bash
   git checkout HEAD~1 -- requirements.txt translator.py config.py agent.py .env
   ```

2. **Or manually**:
   - Revert `.env`: Uncomment `GEMINI_API_KEY`
   - Run: `pip install google-generativeai`

---

**Questions?** Check the troubleshooting section or refer to official Google Cloud documentation.

**Migration Date**: 2025-10-10
**SDK Version**: `google-genai` v1.33.0
