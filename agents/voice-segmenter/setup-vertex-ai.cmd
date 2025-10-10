@echo off
REM ========================================
REM Vertex AI Setup Script for bayaan-meets
REM ========================================

echo.
echo ======================================
echo Vertex AI Setup for bayaan-meets
echo ======================================
echo.

REM Step 1: Check if gcloud is installed
echo [Step 1/7] Checking Google Cloud CLI installation...
gcloud --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Google Cloud CLI not found!
    echo Please install from: https://cloud.google.com/sdk/docs/install#windows
    pause
    exit /b 1
)
echo ✅ Google Cloud CLI installed
echo.

REM Step 2: Set project
echo [Step 2/7] Setting project to bayaan-meets...
gcloud config set project bayaan-meets
if %errorlevel% neq 0 (
    echo WARNING: Project might not exist yet. Creating it requires owner permissions.
    echo If this fails, create the project manually at: https://console.cloud.google.com/
    pause
)
echo ✅ Project set
echo.

REM Step 3: Enable required APIs
echo [Step 3/7] Enabling Vertex AI API...
echo This may take 1-2 minutes...
gcloud services enable aiplatform.googleapis.com --project=bayaan-meets
if %errorlevel% neq 0 (
    echo ERROR: Failed to enable Vertex AI API
    echo Make sure billing is enabled: https://console.cloud.google.com/billing
    pause
    exit /b 1
)
echo ✅ Vertex AI API enabled
echo.

echo [Step 4/7] Enabling Generative Language API...
gcloud services enable generativelanguage.googleapis.com --project=bayaan-meets
echo ✅ Generative Language API enabled
echo.

REM Step 5: Authenticate
echo [Step 5/7] Setting up authentication...
echo This will open your browser for login...
pause
gcloud auth application-default login
if %errorlevel% neq 0 (
    echo ERROR: Authentication failed
    pause
    exit /b 1
)
echo ✅ Authentication successful
echo.

REM Step 6: Update .env file
echo [Step 6/7] Updating .env file...
echo # Vertex AI Configuration > .env.new
echo LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud >> .env.new
echo LIVEKIT_API_KEY=API3iYYRirpXUmf >> .env.new
echo LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C >> .env.new
echo. >> .env.new
echo # Vertex AI Configuration >> .env.new
echo GOOGLE_CLOUD_PROJECT=bayaan-meets >> .env.new
echo GOOGLE_CLOUD_LOCATION=us-central1 >> .env.new
echo. >> .env.new
echo # Output Configuration >> .env.new
echo OUTPUT_DIR=segments >> .env.new
echo SAVE_AUDIO=true >> .env.new
echo SAVE_TRANSLATIONS=false >> .env.new
echo. >> .env.new
echo # Logging >> .env.new
echo LOG_LEVEL=INFO >> .env.new

echo Backing up old .env to .env.backup...
copy .env .env.backup >nul 2>&1
echo Applying new .env configuration...
move /y .env.new .env >nul
echo ✅ Configuration updated
echo.

REM Step 7: Install Python dependencies
echo [Step 7/7] Installing Python dependencies...
echo Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Could not activate virtual environment
    echo Run: python -m venv venv
    pause
    exit /b 1
)

echo Installing new dependencies...
pip install --upgrade pip
pip install --upgrade google-genai google-auth
echo ✅ Dependencies installed
echo.

REM Test configuration
echo ======================================
echo Testing Configuration...
echo ======================================
python test_config.py
if %errorlevel% neq 0 (
    echo WARNING: Configuration test failed
    echo Please check the error messages above
    pause
)

echo.
echo ======================================
echo ✅ Setup Complete!
echo ======================================
echo.
echo Next steps:
echo 1. Verify billing is enabled: https://console.cloud.google.com/billing/linkedaccount?project=bayaan-meets
echo 2. Test the agent: python agent.py dev
echo.
echo Configuration saved in: .env
echo Backup of old config: .env.backup
echo.
pause
