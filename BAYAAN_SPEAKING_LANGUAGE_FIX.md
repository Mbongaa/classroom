# Bayaan Agent Fix: Respect Teacher's `speaking_language` Attribute

## 🐛 Bug Summary

**Issue**: Bayaan transcription agent ignores teacher's `speaking_language` attribute, always using database configuration (Arabic) instead of teacher's selected language.

**Impact**:
- Teachers select English in PreJoin → Get Arabic transcriptions
- `speaking_language='en'` is sent but ignored by agent
- Only `captions_language` (students) is processed

---

## 🔍 Root Cause

**Location**: `mbongaa-bayaan-server/main.py` (or `main_production.py`)

**Handler**: `@job.room.on("participant_attributes_changed")`

**Current Code** (~line 11221):
```python
@job.room.on("participant_attributes_changed")
def on_attributes_changed(changed_attributes: dict[str, str], participant: rtc.Participant):
    logger.info(f"🌍 Participant {participant.identity} attributes changed: {changed_attributes}")

    # ONLY checks captions_language (for student translators)
    lang = changed_attributes.get("captions_language", None)
    if lang:
        # Create/update translators...

    # ❌ MISSING: No check for speaking_language (teacher's transcription language)
```

---

## ✅ The Fix

### Code Changes Required

Replace the `on_attributes_changed` handler with:

```python
@job.room.on("participant_attributes_changed")
def on_attributes_changed(changed_attributes: dict[str, str], participant: rtc.Participant):
    """
    When participant attributes change, handle new translation requests
    and source language updates.
    """
    logger.info(f"🌍 Participant {participant.identity} attributes changed: {changed_attributes}")

    # ✅ NEW: Check for speaking_language changes (teacher's transcription language)
    speaking_lang = changed_attributes.get("speaking_language", None)
    if speaking_lang:
        nonlocal source_language

        if speaking_lang != source_language:
            logger.info(f"🔄 Teacher changed source language: {source_language} → {speaking_lang}")
            logger.info(f"🎤 Participant {participant.identity} (teacher) now speaking in: {languages.get(speaking_lang, {}).get('name', speaking_lang)}")

            # Update the source language for future transcriptions
            old_language = source_language
            source_language = speaking_lang

            logger.info(f"✅ Updated transcription source language from {old_language} to {source_language}")
            logger.info(f"📝 New audio tracks will be transcribed in: {languages.get(source_language, {}).get('name', source_language)}")

            # Note: Existing STT streams continue with old language
            # Only new tracks will use the updated source_language
        else:
            logger.debug(f"Speaking language unchanged: {speaking_lang}")

    # Existing captions_language logic (for student translators)
    lang = changed_attributes.get("captions_language", None)
    if lang:
        if lang == source_language:
            logger.info(f"✅ Participant {participant.identity} requested {languages[source_language].name} (source language - no translation needed)")
        elif lang in translators:
            logger.info(f"✅ Participant {participant.identity} requested existing language: {lang}")
            logger.info(f"📊 Current translators for this room: {list(translators.keys())}")
        else:
            # Check if the language is supported and different from source language
            if lang in languages:
                try:
                    # Create a translator for the requested language using the language enum
                    language_obj = languages[lang]
                    language_enum = getattr(LanguageCode, language_obj.name)
                    translators[lang] = Translator(job.room, language_enum, tenant_context, broadcast_to_displays)
                    logger.info(f"🆕 Added translator for ROOM {job.room.name} (requested by {participant.identity}), language: {language_obj.name}")
                    logger.info(f"🏢 Translator created with tenant context: mosque_id={tenant_context.get('mosque_id')}")
                    logger.info(f"📊 Total translators for room {job.room.name}: {len(translators)} -> {list(translators.keys())}")
                    logger.info(f"🔍 Translators dict ID: {id(translators)}")

                    # Debug: Verify the translator was actually added
                    if lang in translators:
                        logger.info(f"✅ Translator verification: {lang} successfully added to room translators")
                    else:
                        logger.error(f"❌ Translator verification FAILED: {lang} not found in translators dict")

                except Exception as e:
                    logger.error(f"❌ Error creating translator for {lang}: {str(e)}")
            else:
                logger.warning(f"❌ Unsupported language requested by {participant.identity}: {lang}")
                logger.info(f"💡 Supported languages: {list(languages.keys())}")
    else:
        logger.debug(f"No caption language change for participant {participant.identity}")
```

---

## 🚀 Deployment Steps

### 1. Update Bayaan Server Repository

```bash
cd /path/to/mbongaa-bayaan-server
git checkout -b fix/speaking-language-attribute

# Edit main.py or main_production.py
# Apply the code changes above

git add main.py main_production.py
git commit -m "Fix: Respect teacher's speaking_language attribute for transcription

- Add speaking_language handler in participant_attributes_changed
- Dynamically update source_language when teacher changes language
- Maintain existing captions_language logic for student translators
- Log language changes for monitoring"

git push origin fix/speaking-language-attribute
```

### 2. Deploy to Render

**Option A**: Merge and auto-deploy
```bash
git checkout main
git merge fix/speaking-language-attribute
git push origin main
# Render will auto-deploy
```

**Option B**: Manual deploy from branch
- Go to Render dashboard
- Trigger manual deploy from `fix/speaking-language-attribute` branch

### 3. Verify Deployment

**Check logs for**:
```
✅ Updated transcription source language from ar to en
📝 New audio tracks will be transcribed in: English
```

---

## ✅ Expected Behavior After Fix

1. **Teacher selects English** in PreJoin → `speaking_language='en'` set
2. **Agent receives attribute change** → Logs detected
3. **Agent updates `source_language`** → `source_language = 'en'`
4. **New audio tracks** → Transcribed in English
5. **Teacher sees English transcriptions** ✅

---

## 📝 Testing Checklist

- [ ] Create new classroom room
- [ ] Teacher selects English in PreJoin
- [ ] Join room as teacher
- [ ] Speak in English
- [ ] Verify English transcriptions appear (not Arabic)
- [ ] Switch to different room with Arabic
- [ ] Verify Arabic transcriptions work
- [ ] Student joins and selects Dutch
- [ ] Verify Dutch translations appear for student

---

## ⚠️ Important Notes

**File to Edit**: `main.py` and/or `main_production.py` in Bayaan server repo
**Repository**: https://github.com/Mbongaa/Bayaan-server.git
**Not in this repo**: This fix is for the separate Bayaan agent server

**Deployment Impact**:
- Zero downtime if using Render's rolling deploy
- Existing sessions will complete with old behavior
- New sessions will use updated logic

**Alternative Quick Fix** (if can't deploy immediately):
- Manually update database `translation_settings` table
- Set `transcription_language='en'` for English classroom rooms
- Set `transcription_language='ar'` for Arabic classroom rooms
