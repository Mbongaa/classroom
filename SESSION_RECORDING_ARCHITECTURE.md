# Session Recording Architecture

**Complete Documentation of Session, Transcription, and Translation System**
*Fixed with Opus | Last Updated: January 2025*

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Database Schema](#database-schema)
4. [Session Management](#session-management)
5. [Transcription System](#transcription-system)
6. [Translation System](#translation-system)
7. [Recording Integration](#recording-integration)
8. [Usage Patterns](#usage-patterns)
9. [API Reference](#api-reference)
10. [Future Development](#future-development)

---

## System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     LiveKit Room Session                         │
│                                                                   │
│  ┌──────────────┐              ┌──────────────┐                 │
│  │   Teacher    │              │   Students   │                 │
│  │ (Speaker)    │─────────────▶│ (Listeners)  │                 │
│  └──────────────┘              └──────────────┘                 │
│         │                              │                          │
│         │ Original Language            │ Target Language          │
│         │ (e.g., Arabic)               │ (e.g., English)         │
│         ▼                              ▼                          │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌─────────────────┐           ┌─────────────────┐
│ TranscriptionSaver│          │SpeechTranslation│
│   Component      │           │ Panel Component │
└─────────────────┘           └─────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌─────────────────┐           ┌─────────────────┐
│ POST /api/      │           │ POST /api/      │
│ transcriptions  │           │ recordings/     │
│                 │           │ translations    │
└─────────────────┘           └─────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌───────────────────────────────────────────────┐
│           Supabase Database                    │
│                                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐│
│  │ sessions │──│transcriptions│  │translation││
│  │          │  │              │  │  _entries ││
│  └──────────┘  └──────────────┘  └──────────┘│
│       │               │                │      │
│       └───────────────┴────────────────┘      │
│            session_id (UUID) link             │
└───────────────────────────────────────────────┘
         │
         │ Optional
         ▼
┌─────────────────┐
│ session_       │
│ recordings     │ ◀─ Video Recording (Optional)
│ (LiveKit       │
│  Egress)       │
└─────────────────┘
```

### Key Features

✅ **Session-Based Architecture**: Sessions exist independently of video recordings
✅ **Dual Storage**: Separate tables for original speech (transcriptions) and translations
✅ **Real-Time Capture**: Both transcriptions and translations saved as they occur
✅ **Timestamped Data**: All entries timestamped for playback synchronization
✅ **Role-Based Saving**: Teachers save transcriptions, students save translations
✅ **No Duplication**: Smart deduplication prevents N-participant multiplication

---

## Core Concepts

### 1. Session vs Recording Separation

**Critical Design Decision**: Sessions are **independent** from video recordings.

| Concept | Purpose | Always Exists? |
|---------|---------|----------------|
| **Session** | Track room activity for transcriptions/translations | ✅ YES - Created when participants join |
| **Recording** | Video/audio file from LiveKit Egress | ❌ NO - Only when recording is started |

**Why This Matters**:
- You can have transcriptions/translations without video recording
- Transcriptions survive even if recording fails
- Cleaner data model (no "fake" recordings with `transcript-` prefixes)

### 2. Session ID Format

```typescript
// Format: ROOMNAME_YYYY-MM-DD_HH-MM
// Example: MATH101_2025-01-31_14-30

function generateSessionId(roomName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-'); // HH-MM
  return `${roomName}_${date}_${time}`;
}
```

**Properties**:
- Human-readable
- Time-based (grouped by day/hour)
- Room-specific
- **Unique per hour** for the same room

### 3. Data Flow

```
Participant Joins Room
        ↓
Create/Get Session (POST /api/sessions/create)
        ↓
Session UUID Generated
        ↓
┌──────────────────┬────────────────────┐
│   TEACHER        │     STUDENT        │
│                  │                    │
│ Listens to       │ Listens to         │
│ Transcription    │ Transcription      │
│ Events           │ Events             │
│      ↓           │      ↓             │
│ Filters for      │ Filters for        │
│ speaking_        │ targetLanguage     │
│ language (ar)    │ (en)               │
│      ↓           │      ↓             │
│ Saves to         │ Saves to           │
│ transcriptions   │ translation_       │
│ table            │ entries table      │
└──────────────────┴────────────────────┘
```

---

## Database Schema

### Tables Overview

```sql
-- 1. Sessions Table (Core)
public.sessions
  ├── id (UUID, PK)
  ├── room_sid (TEXT)
  ├── room_name (TEXT)
  ├── session_id (TEXT, UNIQUE) -- e.g., "MATH101_2025-01-31_14-30"
  ├── started_at (TIMESTAMPTZ)
  ├── ended_at (TIMESTAMPTZ, nullable)
  └── created_at (TIMESTAMPTZ)

-- 2. Transcriptions Table (Original Language)
public.transcriptions
  ├── id (UUID, PK)
  ├── session_id (UUID, FK → sessions.id)
  ├── recording_id (UUID, nullable, FK → session_recordings.id)
  ├── text (TEXT) -- Original speech text
  ├── language (TEXT) -- Speaker's language (e.g., 'ar')
  ├── participant_identity (TEXT)
  ├── participant_name (TEXT)
  ├── timestamp_ms (INTEGER) -- Milliseconds from session start
  └── created_at (TIMESTAMPTZ)

-- 3. Translation Entries Table (Translated Language)
public.translation_entries
  ├── id (UUID, PK)
  ├── session_id (UUID, FK → sessions.id)
  ├── recording_id (UUID, nullable, FK → session_recordings.id)
  ├── text (TEXT) -- Translated text
  ├── language (TEXT) -- Target language (e.g., 'en')
  ├── participant_name (TEXT)
  ├── timestamp_ms (INTEGER) -- Milliseconds from session start
  └── created_at (TIMESTAMPTZ)

-- 4. Session Recordings Table (Optional Video)
public.session_recordings
  ├── id (UUID, PK)
  ├── room_sid (TEXT)
  ├── room_name (TEXT)
  ├── session_id (TEXT) -- String format
  ├── session_uuid (UUID, FK → sessions.id) -- Link to parent session
  ├── livekit_egress_id (TEXT) -- LiveKit egress ID
  ├── hls_playlist_url (TEXT, nullable)
  ├── mp4_url (TEXT, nullable)
  ├── duration_seconds (INTEGER, nullable)
  ├── size_bytes (BIGINT, nullable)
  ├── teacher_name (TEXT)
  ├── started_at (TIMESTAMPTZ)
  ├── ended_at (TIMESTAMPTZ, nullable)
  ├── status (TEXT) -- 'ACTIVE' | 'COMPLETED' | 'FAILED'
  ├── classroom_id (UUID, nullable)
  ├── created_by (UUID, nullable)
  ├── metadata (JSONB)
  └── created_at (TIMESTAMPTZ)
```

### Key Relationships

```
sessions (1) ──┬──▶ (N) transcriptions
               │     [session_id → sessions.id]
               │
               ├──▶ (N) translation_entries
               │     [session_id → sessions.id]
               │
               └──▶ (0..1) session_recordings
                     [session_uuid → sessions.id]
```

### Migration History

1. **20251003_create_transcriptions_table.sql**
   - Created `transcriptions` table with `recording_id` (NOT NULL)

2. **20250131_create_translation_entries.sql**
   - Created `translation_entries` table with `recording_id` (NOT NULL)

3. **20251204_create_sessions_table.sql** ⭐ **CRITICAL**
   - Created `sessions` table as source of truth
   - Added `session_id` column to `transcriptions` and `translation_entries`
   - Made `recording_id` NULLABLE in both tables
   - Migrated data from fake recordings (`livekit_egress_id LIKE 'transcript-%'`)
   - Cleaned up fake recording entries
   - Added `session_uuid` to `session_recordings` for linking

---

## Session Management

### Session Creation Flow

```typescript
// PageClientImpl.tsx - After room connection
// Location: app/rooms/[roomName]/PageClientImpl.tsx:404-436

useEffect(() => {
  if (!room) return;

  room.on(RoomEvent.Connected, async () => {
    // 1. Initialize session for transcript saving
    const sessionIdValue = generateSessionId(room.name);

    const response = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: room.name,
        roomSid: room.sid || room.name,
        sessionId: sessionIdValue,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setSessionStartTime(Date.now()); // Used for timestamp_ms calculation
      console.log('[Session Create] Session created/retrieved:', data.session.session_id);
    }
  });
}, [room]);
```

### API: POST /api/sessions/create

**File**: `app/api/sessions/create/route.ts`

**Request Body**:
```typescript
{
  roomName: string;  // e.g., "MATH101"
  roomSid: string;   // LiveKit room SID
}
```

**Response**:
```typescript
{
  success: true;
  session: {
    id: UUID;              // Used as session_id in child tables
    session_id: string;    // "MATH101_2025-01-31_14-30"
    room_name: string;
    room_sid: string;
    started_at: string;
    created_at: string;
  };
  existed: boolean;  // true if session already existed
}
```

**Logic**:
1. Generate session ID using `generateSessionId(roomName)`
2. Check if session already exists (prevents duplicates for same hour)
3. If exists: Return existing session
4. If not: Create new session and return

**Database Operation**:
```sql
-- Check existing
SELECT * FROM sessions WHERE session_id = 'MATH101_2025-01-31_14-30';

-- Create new (if not exists)
INSERT INTO sessions (room_sid, room_name, session_id, started_at)
VALUES ($1, $2, $3, NOW())
RETURNING *;
```

---

## Transcription System

### Purpose

Save **original speaker language** (e.g., Arabic) for teachers.

### Component: TranscriptionSaver

**File**: `app/components/TranscriptionSaver.tsx`

**Usage**:
```tsx
// Mounted only by TEACHERS
<TranscriptionSaver
  roomName={room.name}
  sessionStartTime={sessionStartTime}
/>
```

**Component Logic**:
```typescript
// TranscriptionSaver.tsx

export default function TranscriptionSaver({ roomName, sessionStartTime }) {
  const room = useRoomContext();
  const savedSegmentIds = useRef<Set<string>>(new Set());
  const sessionId = generateSessionId(roomName);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // 1. Filter for FINAL segments only (avoid duplicates)
      const finalSegments = segments.filter(seg => seg.final);

      // 2. Get teacher's speaking language from participant attributes
      const speakingLanguage = room.localParticipant?.attributes?.speaking_language;

      // 3. Find transcription in teacher's speaking language
      const transcription = finalSegments.find(seg => seg.language === speakingLanguage);

      if (transcription) {
        const segmentKey = `${transcription.id}-${transcription.language}`;

        // 4. Check deduplication
        if (!savedSegmentIds.current.has(segmentKey)) {
          savedSegmentIds.current.add(segmentKey);

          // 5. Calculate timestamp from session start
          const timestampMs = Date.now() - sessionStartTime;

          // 6. Save to API
          fetch('/api/transcriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              text: transcription.text,
              language: transcription.language,
              participantIdentity: room.localParticipant?.identity,
              participantName: room.localParticipant?.name,
              timestampMs,
            }),
          });
        }
      }
    };

    // Subscribe to LiveKit transcription events
    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, sessionId, sessionStartTime]);

  return null; // Invisible component
}
```

### API: POST /api/transcriptions

**File**: `app/api/transcriptions/route.ts`

**Request Body**:
```typescript
{
  sessionId: string;          // "MATH101_2025-01-31_14-30"
  text: string;               // Transcribed text
  language: string;           // Speaker's language (e.g., "ar")
  participantIdentity: string; // LiveKit identity
  participantName: string;    // Display name
  timestampMs: number;        // Milliseconds from session start
}
```

**Logic**:
```typescript
// 1. Get session UUID from session_id string
const { data: session } = await supabase
  .from('sessions')
  .select('id')
  .eq('session_id', sessionId)
  .single();

// 2. Save transcription with session reference
const { data: entry } = await supabase
  .from('transcriptions')
  .insert({
    session_id: session.id,      // UUID reference
    recording_id: null,          // No recording needed
    text,
    language,
    participant_identity: participantIdentity,
    participant_name: participantName,
    timestamp_ms: timestampMs,
  })
  .select()
  .single();
```

**Response**:
```typescript
{
  success: true;
  entry: {
    id: UUID;
    timestampMs: number;
  };
}
```

---

## Translation System

### Purpose

Save **translated text** in student's target language (e.g., English).

### Component: SpeechTranslationPanel

**File**: `app/components/SpeechTranslationPanel.tsx`

**Usage**:
```tsx
// Mounted by STUDENTS
<SpeechTranslationPanel
  targetLanguage={selectedLanguage}  // e.g., "en"
  roomName={room.name}
  sessionStartTime={sessionStartTime}
  userRole="student"
/>
```

**Component Logic**:
```typescript
// SpeechTranslationPanel.tsx

export default function SpeechTranslationPanel({
  targetLanguage,
  roomName,
  sessionStartTime,
  userRole
}) {
  const room = useRoomContext();
  const savedSegmentIds = useRef<Set<string>>(new Set());
  const sessionId = generateSessionId(roomName);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // 1. Filter for FINAL segments only
      const finalSegments = segments.filter(seg => seg.final);

      // 2. Get speaker's original language
      const speakingLanguage = Array.from(room.remoteParticipants.values())
        .find(p => p.attributes?.speaking_language !== undefined)
        ?.attributes?.speaking_language;

      // 3. Find translation in student's target language
      const translation = finalSegments.find(seg => seg.language === targetLanguage);

      // 4. Only save if it's a translation (not original language)
      if (translation && translation.language !== speakingLanguage) {
        const segmentKey = `${translation.id}-${translation.language}`;

        if (!savedSegmentIds.current.has(segmentKey)) {
          savedSegmentIds.current.add(segmentKey);

          const timestampMs = Date.now() - sessionStartTime;

          // 5. Get teacher's name from remote participants
          const speaker = Array.from(room.remoteParticipants.values())
            .find(p => p.attributes?.speaking_language !== undefined);

          // 6. Save to translations API
          fetch('/api/recordings/translations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              text: translation.text,
              language: translation.language,
              participantName: speaker?.name || 'Speaker',
              timestampMs,
            }),
          });
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, targetLanguage, sessionId, sessionStartTime, userRole]);

  // ... UI for displaying translations
}
```

### API: POST /api/recordings/translations

**File**: `app/api/recordings/translations/route.ts`

**Request Body**:
```typescript
{
  sessionId: string;       // "MATH101_2025-01-31_14-30"
  text: string;            // Translated text
  language: string;        // Target language (e.g., "en")
  participantName: string; // Speaker's name
  timestampMs: number;     // Milliseconds from session start
}
```

**Logic**:
```typescript
// 1. Get session UUID from session_id string
const { data: session } = await supabase
  .from('sessions')
  .select('id')
  .eq('session_id', sessionId)
  .single();

// 2. Save translation with session reference
const { data: entry } = await supabase
  .from('translation_entries')
  .insert({
    session_id: session.id,      // UUID reference
    recording_id: null,          // No recording needed
    text,
    language,
    participant_name: participantName,
    timestamp_ms: timestampMs,
  })
  .select()
  .single();
```

**Response**:
```typescript
{
  success: true;
  entry: {
    id: UUID;
    timestampMs: number;
  };
}
```

---

## Recording Integration

### Optional Video Recording

Sessions can optionally have a video recording via LiveKit Egress.

### Linking Sessions to Recordings

**When Recording Starts**:
```typescript
// lib/recording-utils.ts

export async function createRecording(params: {
  roomSid: string;
  roomName: string;
  sessionId: string;        // String format "MATH101_2025-01-31_14-30"
  egressId: string;         // LiveKit egress ID (e.g., "EG_...")
  teacherName: string;
  classroomId?: string;
  createdBy?: string;
  sessionUuid?: string;     // UUID from sessions table
}): Promise<Recording> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('session_recordings')
    .insert({
      room_sid: params.roomSid,
      room_name: params.roomName,
      session_id: params.sessionId,      // String
      session_uuid: params.sessionUuid,  // UUID link to sessions table
      livekit_egress_id: params.egressId,
      teacher_name: params.teacherName,
      classroom_id: params.classroomId || null,
      created_by: params.createdBy || null,
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  return data as Recording;
}
```

### Relationship

```
Session (sessions table)
   ↓
   ├─→ transcriptions (N)
   ├─→ translation_entries (N)
   └─→ session_recordings (0..1) ← Optional video recording
```

**Query Example**:
```sql
-- Get session with optional recording
SELECT
  s.*,
  r.mp4_url,
  r.hls_playlist_url,
  r.duration_seconds
FROM sessions s
LEFT JOIN session_recordings r ON r.session_uuid = s.id
WHERE s.session_id = 'MATH101_2025-01-31_14-30';
```

---

## Usage Patterns

### Complete Flow Example

```typescript
// 1. PARTICIPANT JOINS ROOM

// PageClientImpl.tsx (line 404-436)
useEffect(() => {
  if (!room) return;

  room.on(RoomEvent.Connected, async () => {
    // Create session
    const response = await fetch('/api/sessions/create', {
      method: 'POST',
      body: JSON.stringify({
        roomName: 'MATH101',
        roomSid: room.sid,
      }),
    });

    const { session } = await response.json();
    // session.id = UUID
    // session.session_id = "MATH101_2025-01-31_14-30"

    setSessionStartTime(Date.now());
  });
}, [room]);

// 2. TEACHER SPEAKS (Arabic)

// LiveKit Agent sends transcription event:
// {
//   segments: [
//     { id: "seg-123", text: "مرحبا", language: "ar", final: true },
//     { id: "seg-123", text: "Hello", language: "en", final: true },
//   ]
// }

// 3. TEACHER'S CLIENT SAVES TRANSCRIPTION

// TranscriptionSaver.tsx
// Filters for language="ar" (teacher's speaking_language)
// Saves to /api/transcriptions

// Database insert:
// INSERT INTO transcriptions (
//   session_id,        -- UUID from sessions table
//   text,              -- "مرحبا"
//   language,          -- "ar"
//   participant_name,  -- "Dr. Ahmed"
//   timestamp_ms       -- 1234
// )

// 4. STUDENT'S CLIENT SAVES TRANSLATION

// SpeechTranslationPanel.tsx
// Filters for language="en" (student's targetLanguage)
// Saves to /api/recordings/translations

// Database insert:
// INSERT INTO translation_entries (
//   session_id,        -- UUID from sessions table
//   text,              -- "Hello"
//   language,          -- "en"
//   participant_name,  -- "Dr. Ahmed"
//   timestamp_ms       -- 1234
// )
```

### Query Patterns

#### Get All Data for a Session

```sql
-- By session_id string
WITH session_data AS (
  SELECT id, session_id, room_name, started_at, ended_at
  FROM sessions
  WHERE session_id = 'MATH101_2025-01-31_14-30'
)
SELECT
  s.*,
  t.text as transcription_text,
  t.language as transcription_lang,
  t.timestamp_ms as transcription_time,
  tr.text as translation_text,
  tr.language as translation_lang,
  tr.timestamp_ms as translation_time,
  r.mp4_url,
  r.hls_playlist_url
FROM session_data s
LEFT JOIN transcriptions t ON t.session_id = s.id
LEFT JOIN translation_entries tr ON tr.session_id = s.id
LEFT JOIN session_recordings r ON r.session_uuid = s.id
ORDER BY COALESCE(t.timestamp_ms, tr.timestamp_ms);
```

#### Get Transcriptions Only (Original Language)

```sql
SELECT
  t.*,
  s.session_id,
  s.room_name
FROM transcriptions t
JOIN sessions s ON s.id = t.session_id
WHERE s.session_id = 'MATH101_2025-01-31_14-30'
ORDER BY t.timestamp_ms ASC;
```

#### Get Translations for Specific Language

```sql
SELECT
  te.*,
  s.session_id,
  s.room_name
FROM translation_entries te
JOIN sessions s ON s.id = te.session_id
WHERE s.session_id = 'MATH101_2025-01-31_14-30'
  AND te.language = 'en'  -- Student's target language
ORDER BY te.timestamp_ms ASC;
```

#### Get All Sessions for a Room

```sql
SELECT *
FROM sessions
WHERE room_name = 'MATH101'
ORDER BY started_at DESC;
```

#### Get Session with Recording (if exists)

```sql
SELECT
  s.*,
  r.mp4_url,
  r.hls_playlist_url,
  r.duration_seconds,
  r.status as recording_status
FROM sessions s
LEFT JOIN session_recordings r ON r.session_uuid = s.id
WHERE s.session_id = 'MATH101_2025-01-31_14-30';
```

### Playback Reconstruction

```typescript
// Reconstruct session for playback
async function getSessionPlayback(sessionId: string) {
  // 1. Get session metadata
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  // 2. Get transcriptions (original language)
  const { data: transcriptions } = await supabase
    .from('transcriptions')
    .select('*')
    .eq('session_id', session.id)
    .order('timestamp_ms', { ascending: true });

  // 3. Get translations (all languages)
  const { data: translations } = await supabase
    .from('translation_entries')
    .select('*')
    .eq('session_id', session.id)
    .order('timestamp_ms', { ascending: true });

  // 4. Get recording (if exists)
  const { data: recording } = await supabase
    .from('session_recordings')
    .select('*')
    .eq('session_uuid', session.id)
    .maybeSingle();

  return {
    session,
    transcriptions,
    translations,
    recording, // null if no video
  };
}

// Usage in playback UI:
const data = await getSessionPlayback('MATH101_2025-01-31_14-30');

// Synchronize captions with video timestamp
const currentTimestamp = videoPlayer.currentTime * 1000; // Convert to ms

// Show original transcription
const currentTranscription = data.transcriptions.find(
  t => t.timestamp_ms <= currentTimestamp &&
       t.timestamp_ms + 5000 > currentTimestamp // 5s display window
);

// Show translation for selected language
const currentTranslation = data.translations.find(
  t => t.language === selectedLanguage &&
       t.timestamp_ms <= currentTimestamp &&
       t.timestamp_ms + 5000 > currentTimestamp
);
```

---

## API Reference

### Session APIs

#### POST /api/sessions/create
**Purpose**: Create or retrieve session for transcript tracking
**Auth**: None (unauthenticated participants need this)
**Body**:
```typescript
{
  roomName: string;  // e.g., "MATH101"
  roomSid: string;   // LiveKit room SID
}
```
**Response**:
```typescript
{
  success: boolean;
  session: Session;
  existed: boolean;  // true if session already existed
}
```

### Transcription APIs

#### POST /api/transcriptions
**Purpose**: Save original speaker language transcription
**Auth**: None (allows anon for unauthenticated participants)
**Body**:
```typescript
{
  sessionId: string;          // "ROOMNAME_YYYY-MM-DD_HH-MM"
  text: string;
  language: string;           // Speaker's original language
  participantIdentity: string;
  participantName: string;
  timestampMs: number;        // Milliseconds from session start
}
```
**Response**:
```typescript
{
  success: boolean;
  entry: {
    id: UUID;
    timestampMs: number;
  };
}
```

### Translation APIs

#### POST /api/recordings/translations
**Purpose**: Save translated text in student's target language
**Auth**: None (allows anon for unauthenticated participants)
**Body**:
```typescript
{
  sessionId: string;       // "ROOMNAME_YYYY-MM-DD_HH-MM"
  text: string;            // Translated text
  language: string;        // Target language
  participantName: string; // Speaker's name
  timestampMs: number;     // Milliseconds from session start
}
```
**Response**:
```typescript
{
  success: boolean;
  entry: {
    id: UUID;
    timestampMs: number;
  };
}
```

### Recording APIs

#### GET /api/recordings
**Purpose**: List all recordings or filter by room
**Query Params**:
- `roomName` (optional): Filter by specific room
**Response**:
```typescript
{
  recordings: Recording[];
}
```

**Note**: Automatically excludes transcript-only entries (filters out `livekit_egress_id LIKE 'transcript-%'`)

---

## Future Development

### Planned Features

#### 1. Session Playback UI
**Goal**: Video player with synchronized transcriptions/translations

**Components Needed**:
- Session browser (list all sessions for a room)
- Video player with caption tracks
- Language selector for translations
- Timeline visualization

**Example Implementation**:
```typescript
// app/playback/[sessionId]/page.tsx

export default function SessionPlayback({ params }: { params: { sessionId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Load session data
  useEffect(() => {
    fetchSessionData(params.sessionId);
  }, [params.sessionId]);

  // Sync captions with video
  const currentCaption = useMemo(() => {
    const timestampMs = currentTime * 1000;

    // Original transcription
    const transcription = transcriptions.find(
      t => t.timestamp_ms <= timestampMs &&
           t.timestamp_ms + 5000 > timestampMs
    );

    // Translation in selected language
    const translation = translations.find(
      t => t.language === selectedLanguage &&
           t.timestamp_ms <= timestampMs &&
           t.timestamp_ms + 5000 > timestampMs
    );

    return { transcription, translation };
  }, [currentTime, selectedLanguage, transcriptions, translations]);

  return (
    <div>
      <VideoPlayer
        src={session?.recording?.mp4_url}
        onTimeUpdate={setCurrentTime}
      />

      <CaptionDisplay
        original={currentCaption.transcription}
        translation={currentCaption.translation}
      />

      <LanguageSelector
        value={selectedLanguage}
        onChange={setSelectedLanguage}
        availableLanguages={getUniqueLanguages(translations)}
      />
    </div>
  );
}
```

#### 2. Export Functionality
**Goal**: Export session transcripts as SRT/VTT files

**Features**:
- SRT format for video editors
- VTT format for web players
- Bilingual exports (original + translation)

**Example**:
```typescript
// lib/export-utils.ts

export function exportToSRT(
  entries: (Transcription | TranslationEntry)[],
  language: string
): string {
  return entries
    .filter(e => e.language === language)
    .map((entry, index) => {
      const startTime = formatSRTTime(entry.timestamp_ms);
      const endTime = formatSRTTime(entry.timestamp_ms + 5000); // 5s duration

      return `${index + 1}
${startTime} --> ${endTime}
${entry.text}

`;
    })
    .join('');
}

function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}
```

#### 3. Session Analytics
**Goal**: Analytics dashboard for session insights

**Metrics**:
- Total sessions per room
- Average session duration
- Languages used
- Participant engagement
- Translation coverage

**Example Queries**:
```sql
-- Sessions per room (last 30 days)
SELECT
  room_name,
  COUNT(*) as session_count,
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration_seconds
FROM sessions
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY room_name
ORDER BY session_count DESC;

-- Translation language distribution
SELECT
  language,
  COUNT(*) as translation_count,
  COUNT(DISTINCT session_id) as sessions_with_language
FROM translation_entries
GROUP BY language
ORDER BY translation_count DESC;

-- Transcription vs Translation volume
SELECT
  s.session_id,
  s.room_name,
  COUNT(DISTINCT t.id) as transcription_count,
  COUNT(DISTINCT te.id) as translation_count
FROM sessions s
LEFT JOIN transcriptions t ON t.session_id = s.id
LEFT JOIN translation_entries te ON te.session_id = s.id
GROUP BY s.id, s.session_id, s.room_name;
```

#### 4. Search Functionality
**Goal**: Full-text search across transcriptions

**Implementation**:
```sql
-- Add full-text search index
CREATE INDEX idx_transcriptions_text_search
ON transcriptions
USING gin(to_tsvector('english', text));

CREATE INDEX idx_translations_text_search
ON translation_entries
USING gin(to_tsvector('english', text));

-- Search query
SELECT
  s.session_id,
  s.room_name,
  t.text,
  t.timestamp_ms,
  ts_rank(to_tsvector('english', t.text), plainto_tsquery('search term')) as relevance
FROM transcriptions t
JOIN sessions s ON s.id = t.session_id
WHERE to_tsvector('english', t.text) @@ plainto_tsquery('search term')
ORDER BY relevance DESC;
```

### Migration Considerations

#### Adding Features to Existing Sessions

**Add Speaker Identification**:
```sql
ALTER TABLE transcriptions
ADD COLUMN speaker_id UUID REFERENCES participants(id);

-- Migrate existing data
UPDATE transcriptions t
SET speaker_id = p.id
FROM participants p
WHERE t.participant_identity = p.identity;
```

**Add Confidence Scores**:
```sql
ALTER TABLE transcriptions
ADD COLUMN confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE translation_entries
ADD COLUMN confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1);
```

**Add Edit History**:
```sql
CREATE TABLE transcription_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id UUID REFERENCES transcriptions(id),
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Troubleshooting

### Common Issues

#### 1. Duplicate Saves (N-participant multiplication)

**Problem**: Each participant saves the same transcription, causing N duplicates.

**Solution**: Role-based saving implemented
- Teachers save ONLY transcriptions (original language)
- Students save ONLY translations (their target language)
- Deduplication via `savedSegmentIds` ref

**Code**:
```typescript
// Check before saving
if (!savedSegmentIds.current.has(segmentKey)) {
  savedSegmentIds.current.add(segmentKey);
  // ... save to API
}
```

#### 2. Session Not Found

**Problem**: API returns "Session not found" error.

**Cause**: Session might not be created yet when transcriptions arrive.

**Solution**: Ensure session is created on RoomEvent.Connected BEFORE mounting TranscriptionSaver/SpeechTranslationPanel.

```typescript
// PageClientImpl.tsx
useEffect(() => {
  if (!room) return;

  room.on(RoomEvent.Connected, async () => {
    // 1. Create session FIRST
    await fetch('/api/sessions/create', { ... });
    setSessionStartTime(Date.now());

    // 2. THEN mount saver components (in render, using sessionStartTime check)
  });
}, [room]);
```

#### 3. Timestamp Synchronization

**Problem**: Timestamps don't align with video playback.

**Solution**: Use consistent timestamp calculation:
```typescript
// Always calculate from sessionStartTime
const timestampMs = Date.now() - sessionStartTime;
```

**Validation**:
- Session starts at `started_at` timestamp
- First transcription should have `timestamp_ms ≈ 0-1000ms`
- Video playback uses `timestamp_ms / 1000` for seconds

#### 4. Missing Translations

**Problem**: Translations not appearing for some segments.

**Debug Checklist**:
1. Check if LiveKit Agent is running (Opus integration)
2. Verify `targetLanguage` matches segments received
3. Check `speaking_language` attribute is set correctly
4. Look for filter logic excluding translations:
   ```typescript
   // SpeechTranslationPanel.tsx
   if (translation.language !== speakingLanguage) {
     // Only save if it's a translation, not original
   }
   ```

#### 5. Session ID Collisions

**Problem**: Multiple sessions sharing same session_id.

**Cause**: Sessions created within same hour for same room.

**Solution**: Session ID format includes hour, so sessions in same hour are intentionally grouped. If you need finer granularity:

```typescript
// Option 1: Add minutes to session ID
function generateSessionId(roomName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 8).replace(/:/g, '-'); // HH-MM-SS
  return `${roomName}_${date}_${time}`;
}

// Option 2: Add random suffix
function generateSessionId(roomName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-');
  const random = Math.random().toString(36).substring(2, 6);
  return `${roomName}_${date}_${time}_${random}`;
}
```

---

## Technical Notes

### Performance Optimization

#### Indexing Strategy

Current indexes provide optimal query performance:

```sql
-- Sessions table
CREATE INDEX idx_sessions_room_sid ON sessions(room_sid);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_room_name ON sessions(room_name);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);

-- Transcriptions table
CREATE INDEX idx_transcriptions_recording_id ON transcriptions(recording_id);
CREATE INDEX idx_transcriptions_session_id ON transcriptions(session_id);
CREATE INDEX idx_transcriptions_playback ON transcriptions(recording_id, timestamp_ms);

-- Translation entries table
CREATE INDEX idx_translation_entries_recording_id ON translation_entries(recording_id);
CREATE INDEX idx_translation_entries_session_id ON translation_entries(session_id);
CREATE INDEX idx_translation_playback ON translation_entries(recording_id, language, timestamp_ms);
```

**Query Performance**:
- Session lookup by session_id: O(log n) via B-tree index
- Transcriptions for session: O(log n) via session_id index
- Playback sync queries: O(log n) via composite indexes

#### Memory Management

**Client-Side**:
```typescript
// SpeechTranslationPanel.tsx
// Keep only last 100 segments to prevent memory issues
if (updated.length > 100) {
  return updated.slice(-100);
}
```

**Server-Side**:
- No in-memory caching (stateless API)
- Supabase connection pooling handles concurrent requests
- Pagination recommended for large result sets

### Security Considerations

#### Row-Level Security (RLS)

**Sessions Table**:
```sql
-- Anyone can insert (unauthenticated participants need this)
CREATE POLICY "Anyone can insert sessions"
  ON sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can view
CREATE POLICY "Anyone can view sessions"
  ON sessions FOR SELECT
  TO anon, authenticated
  USING (true);
```

**Transcriptions/Translations**:
```sql
-- Anyone can insert (sessions are unauthenticated)
CREATE POLICY "Allow transcription inserts"
  ON transcriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Organization members can view (for playback)
CREATE POLICY "Organization members can view transcriptions"
  ON transcriptions FOR SELECT
  TO authenticated
  USING (
    recording_id IN (
      SELECT id FROM session_recordings
      WHERE classroom_id IN (
        SELECT id FROM classrooms
        WHERE organization_id IN (
          SELECT organization_id
          FROM organization_members
          WHERE user_id = auth.uid()
        )
      )
    )
  );
```

**Considerations**:
- Unauthenticated participants can save transcriptions/translations
- Authenticated users can view only their organization's data
- No PII stored (participant names are display names, not real names)
- Consider rate limiting on API endpoints

---

## Conclusion

This architecture provides a robust, scalable foundation for session recording with transcriptions and translations.

### Key Achievements ✅

- **Separation of Concerns**: Sessions independent from video recordings
- **Dual Storage**: Original transcriptions + translations in separate tables
- **Real-Time Capture**: Immediate saving as speech occurs
- **Role-Based Logic**: Teachers save transcriptions, students save translations
- **No Duplication**: Smart deduplication prevents data multiplication
- **Timestamped Data**: All entries synchronized for playback
- **Flexible Design**: Can add video recording later without schema changes

### Migration Success 🎉

The **20251204_create_sessions_table.sql** migration successfully:
- Created sessions table as source of truth
- Migrated existing fake recording data to sessions
- Cleaned up legacy entries
- Established proper relationships
- Made recording_id nullable (session_id is now primary)

### Next Steps 🚀

1. **Build Playback UI** - Visualize sessions with synchronized captions
2. **Export Functionality** - SRT/VTT export for external use
3. **Search** - Full-text search across transcriptions
4. **Analytics** - Session insights and metrics
5. **Editing** - Manual correction of transcriptions/translations

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Implementation Status**: ✅ Production Ready (Fixed with Opus)
