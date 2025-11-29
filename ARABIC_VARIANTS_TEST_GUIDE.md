# Arabic Variants Testing Guide

## Implementation Summary

We've successfully added support for Arabic Mixed and Arabic Darija (Moroccan dialect) that will be processed by the Vertex AI translation agent instead of the Bayaan/Speechmatics agent.

### Changes Made:

1. **Frontend Language Selector** (`/app/components/PreJoinLanguageSelect.tsx`)
   - Added `'ar-mixed'` - Arabic Mixed (code-switching)
   - Added `'ar-darija'` - Moroccan Arabic/Darija
   - Original `'ar'` - Arabic Fusha (unchanged)

2. **Bayaan Agent Safety Checks** (`/Translator Server_Arabic_Fusha/Bayaan-server/main.py`)
   - Added validation in `on_track_subscribed` handler
   - Added validation in `on_attributes_changed` handler
   - Bayaan now explicitly rejects non-Fusha Arabic variants

3. **Routing Logic** (`/app/api/connection-details/route.ts`)
   - No changes needed! Already routes correctly:
   - `'ar'` → Bayaan LiveKit server
   - `'ar-mixed'` and `'ar-darija'` → Vertex AI LiveKit server

## Test Cases

### Test 1: Arabic Fusha (Existing Behavior)
1. Create a new classroom
2. Select **"العربية الفصحى (Arabic Fusha)"** as the language
3. Start the classroom
4. Check server logs:
   - Should see connection to **Bayaan LiveKit server**
   - Bayaan agent logs: `"✅ Adding Arabic transcriber for participant"`
   - Speechmatics STT should be active

### Test 2: Arabic Mixed (NEW)
1. Create a new classroom
2. Select **"عربي مختلط (Arabic Mixed)"** as the language
3. Start the classroom
4. Check server logs:
   - Should see connection to **Vertex AI LiveKit server**
   - Vertex AI agent should process the audio
   - Bayaan agent should NOT be involved
   - If Bayaan somehow receives it, should see: `"⚠️ Bayaan agent received non-Fusha language 'ar-mixed'"`

### Test 3: Arabic Darija (NEW)
1. Create a new classroom
2. Select **"الدارجة (Moroccan Arabic)"** as the language
3. Start the classroom
4. Check server logs:
   - Should see connection to **Vertex AI LiveKit server**
   - Vertex AI agent should process the audio
   - Bayaan agent should NOT be involved
   - If Bayaan somehow receives it, should see: `"⚠️ Bayaan agent received non-Fusha language 'ar-darija'"`

### Test 4: Runtime Language Switch (Safety Check)
1. Start with Arabic Fusha classroom
2. Try to manually change `speaking_language` attribute to `'ar-mixed'`
3. Bayaan agent should log warning and ignore the change:
   ```
   ⚠️ Bayaan agent received non-Fusha language change to 'ar-mixed'
   ⚠️ Arabic Mixed and Darija should use Vertex AI server. Ignoring language change.
   ```

## Verification Points

### Frontend (Browser DevTools)
1. **Network Tab**: Check `/api/connection-details` response
   - For `ar`: Should use Bayaan credentials
   - For `ar-mixed` or `ar-darija`: Should use Vertex AI credentials

2. **Console Logs**: Look for language selection
   ```javascript
   console.log('Selected language:', selectedLanguage);
   ```

### Backend Logs

#### Bayaan Server Logs
```bash
# For Arabic Fusha:
✅ Adding Arabic transcriber for participant: teacher
🔍 Language source: participant attribute (speaking_language)

# For Arabic Mixed/Darija (safety check):
⚠️ Bayaan agent received non-Fusha language 'ar-mixed' from teacher
⚠️ This participant should be on Vertex AI server. Skipping transcription.
```

#### Vertex AI Agent Logs
```bash
# For Arabic Mixed/Darija:
🎤 Initial source language set: ar-mixed
✅ Updated source language for transcription
```

## Gemini STT Language Support

The Vertex AI agent uses Google Gemini 2.5 Flash which should support:
- Standard Arabic (`ar`)
- Arabic dialect detection (may auto-detect mixed/dialect)
- Code-switching detection for multilingual speech

**Note**: Gemini may internally map `ar-mixed` and `ar-darija` to its own dialect detection system.

## Troubleshooting

### Issue: Wrong Server Selected
- **Check**: `/api/connection-details/route.ts` line 24-40
- **Verify**: Only exact `'ar'` routes to Bayaan
- **Solution**: Clear browser cache, restart classroom

### Issue: Bayaan Processing Wrong Language
- **Check**: Bayaan logs for safety check warnings
- **Verify**: Safety checks in `main.py` lines 573-576 and 688-691
- **Solution**: Restart Bayaan agent to pick up code changes

### Issue: Vertex AI Not Recognizing Language Code
- **Check**: Vertex AI agent logs for language setting
- **Verify**: Gemini API accepts the language code
- **Fallback**: May need to map `ar-mixed`/`ar-darija` to `ar` for Gemini

## Next Steps

1. Test all three language variants
2. Verify Gemini STT quality for Arabic dialects
3. Consider adding more Arabic dialects if needed:
   - Egyptian Arabic (`ar-egypt`)
   - Levantine Arabic (`ar-levant`)
   - Gulf Arabic (`ar-gulf`)

## Environment Variables Required

```env
# Bayaan Server (Arabic Fusha only)
LIVEKIT_API_KEY=<bayaan_key>
LIVEKIT_API_SECRET=<bayaan_secret>
LIVEKIT_URL=wss://bayaan.livekit.cloud

# Vertex AI Server (All other languages)
LIVEKIT_VERTEX_API_KEY=<vertex_key>
LIVEKIT_VERTEX_API_SECRET=<vertex_secret>
LIVEKIT_VERTEX_URL=wss://vertex.livekit.cloud
```