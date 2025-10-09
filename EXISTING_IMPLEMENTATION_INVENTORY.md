# Existing Implementation Inventory

**Purpose**: Document what's already built in the classroom app to avoid duplicate work

**Date**: 2025-10-08
**Status**: Complete Analysis

---

## ✅ What's Already Implemented

### 1. Frontend Components (100% Complete)

#### 1.1 Language Selection UI
**File**: `app/components/LanguageSelect.tsx`

**What it does**:
- ✅ Fetches available languages from agent via RPC (`get/languages`)
- ✅ Displays language dropdown with flags
- ✅ Sets `captions_language` participant attribute on change
- ✅ Polls for agent connection (3-second intervals)
- ✅ Shows loading state while waiting for agent

**Code flow**:
```typescript
// 1. Find agent participant
const agentParticipant = room.remoteParticipants.find(p => p.identity === 'agent');

// 2. Call RPC method
const response = await room.localParticipant.performRpc({
  destinationIdentity: 'agent',
  method: 'get/languages',
  payload: ''
});

// 3. Set language
await room.localParticipant.setAttributes({
  captions_language: selectedLanguage
});
```

**Status**: ✅ **No changes needed** - Will work with Node.js agent

---

#### 1.2 Live Captions Display
**File**: `app/components/Captions.tsx`

**What it does**:
- ✅ Listens to `RoomEvent.TranscriptionReceived` events
- ✅ Filters transcription segments by selected language
- ✅ Displays last 2 caption segments
- ✅ Auto-fades older captions
- ✅ Shows bottom-centered overlay

**Code flow**:
```typescript
// Listen for transcriptions
room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[]) => {
  const filteredSegments = segments.filter(seg =>
    seg.language === captionsLanguage
  );
  // Update UI
});
```

**Status**: ✅ **No changes needed** - Already consumes LiveKit transcriptions

---

#### 1.3 Translation Panel (Advanced View)
**File**: `app/components/TranslationPanel.tsx`

**What it does**:
- ✅ Receives and displays translation history
- ✅ Shows participant names and timestamps
- ✅ Saves transcriptions to database (via API routes)
- ✅ Handles both teacher (transcription) and student (translation) modes
- ✅ Prevents duplicate saves with segment ID tracking

**Database integration**:
```typescript
// Teachers save original transcription
fetch('/api/transcriptions', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    text: transcription.text,
    language: transcription.language,
    participantIdentity,
    participantName,
    timestampMs
  })
});

// Students save translations
fetch('/api/recordings/translations', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    text: translation.text,
    language: translation.language,
    participantName,
    timestampMs
  })
});
```

**Status**: ✅ **No changes needed** - Database integration ready

---

### 2. Participant Attribute System (100% Complete)

#### 2.1 Teacher Language Selection
**File**: `app/rooms/[roomName]/PageClientImpl.tsx` (lines 395+)

**What it does**:
- ✅ Teachers select `speaking_language` (Arabic, English, etc.)
- ✅ Set via `setAttributes({ speaking_language: 'en' })`
- ✅ Used by agent to determine transcription language
- ✅ Auto-populated from classroom metadata if available

**Attribute key**: `speaking_language`

**Usage**:
```typescript
// Teacher sets speaking language in PreJoin
const attributeKey = classroomRole === 'teacher'
  ? 'speaking_language'
  : 'captions_language';

await room.localParticipant.setAttributes({
  [attributeKey]: selectedLanguage
});
```

**Status**: ✅ **Already working** - Agent must listen to this attribute

---

#### 2.2 Student Language Selection
**File**: `app/components/LanguageSelect.tsx` (line 32-34)

**What it does**:
- ✅ Students select `captions_language` (translation target)
- ✅ Set via `setAttributes({ captions_language: 'es' })`
- ✅ Used by agent to spawn translator for that language

**Attribute key**: `captions_language`

**Status**: ✅ **Already working** - Agent must listen to this attribute

---

### 3. Database Schema (100% Complete)

#### 3.1 Transcriptions Table
**Table**: `transcriptions`

**Columns**:
- `id` - UUID primary key
- `session_id` - References sessions table
- `text` - Original transcription text
- `language` - Source language code
- `participant_identity` - LiveKit participant ID
- `participant_name` - Display name
- `timestamp_ms` - Relative timestamp from session start
- `created_at` - Absolute timestamp

**API Route**: `/api/transcriptions` (POST)

**Status**: ✅ **No changes needed**

---

#### 3.2 Translations Table
**Table**: `translations`

**Columns**:
- `id` - UUID primary key
- `session_id` - References sessions table
- `text` - Translated text
- `language` - Target language code
- `participant_name` - Speaker name
- `timestamp_ms` - Relative timestamp from session start
- `created_at` - Absolute timestamp

**API Route**: `/api/recordings/translations` (POST)

**Status**: ✅ **No changes needed**

---

#### 3.3 Sessions Table
**Table**: `sessions`

**Columns**:
- `id` - UUID primary key
- `classroom_id` - References classrooms table
- `started_at` - Session start time
- `ended_at` - Session end time
- `status` - 'active' | 'completed'

**Used for**: Grouping transcriptions/translations by classroom session

**Status**: ✅ **Already in use**

---

### 4. API Routes (100% Complete)

#### 4.1 Connection Details (Token Generation)
**File**: `app/api/connection-details/route.ts`

**What it does**:
- ✅ Generates LiveKit access tokens
- ✅ Sets participant metadata with role
- ✅ Handles classroom lookup (room_code → UUID)
- ✅ Sets proper permissions for teacher/student

**Metadata structure**:
```typescript
{
  role: 'teacher' | 'student',
  classroom_id: string,  // UUID
  organization_id: string
}
```

**Status**: ✅ **No changes needed**

---

#### 4.2 Transcription Save
**File**: `app/api/transcriptions/route.ts`

**What it does**:
- ✅ Saves teacher's original speech transcriptions
- ✅ Associated with session_id
- ✅ Stores language code

**Status**: ✅ **Already working**

---

#### 4.3 Translation Save
**File**: `app/api/recordings/translations/route.ts`

**What it does**:
- ✅ Saves student's translation captions
- ✅ Associated with session_id
- ✅ Stores target language code

**Status**: ✅ **Already working**

---

### 5. Room Integration (100% Complete)

#### 5.1 Classroom Client
**File**: `app/rooms/[roomName]/ClassroomClientImplWithRequests.tsx`

**What it does**:
- ✅ Manages classroom layout (teacher spotlight + student grid)
- ✅ Tracks teacher via `speaking_language` attribute
- ✅ Displays translation sidebar
- ✅ Handles student requests (raise hand, questions)

**Status**: ✅ **No changes needed**

---

#### 5.2 Speech Client
**File**: `app/rooms/[roomName]/SpeechClientImplWithRequests.tsx`

**What it does**:
- ✅ Similar to classroom but for speech/lecture mode
- ✅ Speaker/listener roles instead of teacher/student

**Status**: ✅ **No changes needed**

---

## ❌ What's NOT Implemented (Agent Side)

### 1. LiveKit Agent Worker ❌

**Missing**: Node.js/TypeScript agent that:
- Joins LiveKit rooms as "agent" participant
- Subscribes to teacher audio tracks
- Segments audio with Silero VAD
- Translates with Gemini API
- Publishes translations via LiveKit Transcription API

**This is what we need to build!**

---

### 2. RPC Method: `get/languages` ❌

**Missing**: Agent endpoint that returns:
```json
[
  { "code": "en", "name": "English", "flag": "🇺🇸" },
  { "code": "es", "name": "Spanish", "flag": "🇪🇸" },
  ...
]
```

**Frontend expects this** (LanguageSelect.tsx line 57-61)

**This is what we need to build!**

---

### 3. Participant Attribute Listener ❌

**Missing**: Agent logic to handle:
```typescript
room.on('participant_attributes_changed', (attributes, participant) => {
  // Handle speaking_language (teacher)
  if (attributes.speaking_language) {
    // Update transcription language
  }

  // Handle captions_language (student)
  if (attributes.captions_language) {
    // Spawn translator for this language
  }
});
```

**This is what we need to build!**

---

### 4. Audio Track Processing ❌

**Missing**: Agent logic to:
```typescript
room.on('track_subscribed', async (track, publication, participant) => {
  if (isTeacher(participant) && track.kind === 'audio') {
    // 1. Create audio stream
    // 2. Apply Silero VAD
    // 3. Segment speech
    // 4. Translate segments
    // 5. Publish translations
  }
});
```

**This is what we need to build!**

---

## 📊 Implementation Scope Summary

### Frontend (0% work needed)
- ✅ Language selection UI
- ✅ Caption display components
- ✅ Translation panel
- ✅ Participant attributes
- ✅ RPC calls
- ✅ Database integration
- ✅ API routes

**Verdict**: **Frontend is 100% ready**

---

### Backend Agent (100% work needed)
- ❌ Agent worker entry point
- ❌ Silero VAD integration
- ❌ Gemini translation
- ❌ RPC method: `get/languages`
- ❌ Participant attribute listener
- ❌ Audio track processing
- ❌ Transcription publishing

**Verdict**: **Agent needs to be built from scratch**

---

## 🎯 Actual Implementation Needed

Based on this inventory, here's what we **actually need to build**:

### Phase 1: Agent Foundation (NEW)
- Create `agents/translation-worker.ts`
- Connect to LiveKit as "agent"
- Register RPC method: `get/languages`
- Log participant join/leave events

**Test**: LanguageSelect dropdown shows languages

---

### Phase 2: VAD Integration (NEW)
- Load Silero VAD model
- Subscribe to teacher audio tracks
- Segment speech with VAD
- Log speech segments

**Test**: Console shows speech segments with text/timestamps

---

### Phase 3: Gemini Translation (NEW)
- Integrate Gemini API
- Translate speech segments
- Handle multiple target languages
- Implement caching

**Test**: Console shows translations in multiple languages

---

### Phase 4: LiveKit Publishing (NEW)
- Publish translations via `publishTranscription()`
- Handle participant attribute changes
- Spawn/destroy translators dynamically

**Test**: Students see live captions in their selected language

---

### Phase 5: Production Polish (NEW)
- Error handling and retries
- Performance optimization
- Monitoring and logging
- Deployment configuration

**Test**: Run for 1 hour without errors

---

## 🔑 Key Takeaways

1. **Frontend is done** - No UI work needed
2. **Database is ready** - No schema changes needed
3. **APIs work** - No backend routes needed
4. **Agent is missing** - This is the entire scope

**Bottom Line**: We're building the agent worker **only**. Everything else already exists and works.

---

## 🚀 Next Steps

1. ✅ Inventory complete (this document)
2. ⏳ Create 5 phase implementation documents
3. ⏳ Build agent phase by phase
4. ⏳ Test and validate each phase
5. ⏳ Deploy to production

**Ready to proceed with phase documents!**
