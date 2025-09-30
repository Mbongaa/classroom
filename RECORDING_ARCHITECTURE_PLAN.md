# Recording Architecture Implementation Plan

> **Status**: 📋 **READY FOR IMPLEMENTATION** - Comprehensive plan for session recording and playback
>
> **Prerequisites**: Supabase database integration must be completed first

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Decision](#architecture-decision)
3. [Current Project Context](#current-project-context)
4. [Database Schema](#database-schema)
5. [Storage Configuration](#storage-configuration)
6. [Implementation Phases](#implementation-phases)
7. [API Specifications](#api-specifications)
8. [Component Specifications](#component-specifications)
9. [Technical Implementation Details](#technical-implementation-details)
10. [Testing Guide](#testing-guide)
11. [Files Summary](#files-summary)

---

## Overview

### Feature Description
Enable teachers to record classroom sessions with synchronized translation cards, allowing students to rewatch with personalized translations in their chosen language.

### Key Features
- 🎥 **Clean Video Recording**: Records teacher audio/video as HLS streams (seekable, streaming-friendly)
- 💬 **Translation Timeline**: Stores translation cards as timestamped sidecar data
- 🎯 **Personalized Playback**: Each student sees their own language translations synced to video
- ⏩ **Full Seeking**: Support rewind/fast-forward with translation card sync
- 📊 **Recording Management**: List, view, download, and delete recordings per room

### Architecture Benefits
- ✅ One egress job per session (not 30 for each student)
- ✅ Clean source media for future re-editing
- ✅ Searchable, indexable translation data
- ✅ Flexible UI changes without re-recording
- ✅ Cost-efficient storage and bandwidth

---

## Architecture Decision

### Chosen Approach: Track Composite Egress + Sidecar Translations

**What We Record:**
1. **Video/Audio Tracks**: Teacher's media streams → HLS playlist + optional MP4
2. **Translation Timeline**: Each translation card → Database with timestamp

**Why This Approach?**

#### ✅ Pros:
- **Efficient**: 1 recording per session (not 30 separate UI recordings)
- **Personalized**: Each student gets their language overlay during playback
- **Searchable**: Translation data queryable for search/jump-to features
- **Flexible**: UI changes don't require re-recording
- **Clean Media**: Untouched audio/video for post-production

#### ❌ Alternative (Room Composite) Rejected:
- Would record 30 web UIs simultaneously (heavy, expensive)
- Baked-in UI can't be changed later
- 30x egress concurrency requirements
- No personalization per student

### LiveKit Egress Types Used

**Track Composite Egress** (Primary):
- Combines specific audio + video tracks into HLS/MP4
- Handles mute/unpublish transitions automatically
- Perfect A/V sync guaranteed by LiveKit
- Source: LiveKit Docs - Track Composite Egress

**Output Formats**:
- **HLS**: Segmented playlist for streaming (fast start/seek, CDN-friendly)
- **MP4**: Single file for downloads (optional, parallel output)

**Seeking Support**:
- HLS VOD playlists support full scrubbing (rewind/forward)
- Granularity tied to segment duration (6 seconds = good balance)
- Works on all platforms (iOS native, Android/Desktop with hls.js)

---

## Current Project Context

### Existing Features (Implemented)

**1. Persistent Rooms** ✅
- Teachers create reusable room codes (e.g., "MATH101")
- Metadata stored in LiveKit (64 KiB per room)
- 7-day empty timeout for room persistence
- Room types: meeting, classroom, speech
- Files: `app/api/rooms/*`, `app/manage-rooms/page.tsx`

**2. Classroom Features** ✅
- Role-based access (teacher/student permissions)
- Teacher controls (grant/revoke speaking permissions)
- Student request system (raise hand, ask questions)
- Custom classroom layout with teacher spotlight
- Files: `app/rooms/[roomName]/ClassroomClient*.tsx`

**3. Translation System** ✅
- Live AI translation via external agent (Bayaan server)
- Translation cards displayed in sidebar
- Language selection per participant
- Real-time via LiveKit transcription events
- Files: `app/components/TranslationPanel.tsx`

### Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Real-time**: LiveKit Cloud (WebRTC, SFU)
- **UI**: React 18, Tailwind CSS, Shadcn UI
- **LiveKit SDKs**:
  - `livekit-client`: v2.15.7
  - `livekit-server-sdk`: v2.13.3
  - `@livekit/components-react`: v2.9.14

### Environment Variables (Current)
```env
# LiveKit (Required)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# Optional (Currently unused)
S3_KEY_ID=
S3_KEY_SECRET=
S3_ENDPOINT=
S3_BUCKET=
S3_REGION=
```

---

## Database Schema

### Supabase Tables

#### Table 1: `recordings`

```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Room identification
  room_sid TEXT NOT NULL,           -- LiveKit room SID
  room_name TEXT NOT NULL,          -- Room code (e.g., "MATH101")
  session_id TEXT UNIQUE NOT NULL,  -- Unique per recording session (e.g., "MATH101_2025-01-30_14-30")
  egress_id TEXT NOT NULL,          -- LiveKit egress ID

  -- Video/audio URLs
  hls_playlist_url TEXT,            -- S3/R2 URL to .m3u8 playlist
  mp4_url TEXT,                     -- Optional MP4 download URL (if dual output)

  -- Recording metadata
  duration_seconds INTEGER,         -- Duration in seconds (from webhook)
  file_size_bytes BIGINT,           -- Total size in bytes

  -- Session info
  teacher_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, COMPLETED, FAILED

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_recordings_room_sid ON recordings(room_sid);
CREATE INDEX idx_recordings_room_name ON recordings(room_name);
CREATE INDEX idx_recordings_session_id ON recordings(session_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_started_at ON recordings(started_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

#### Table 2: `translation_entries`

```sql
CREATE TABLE translation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,

  -- Translation data
  text TEXT NOT NULL,
  language TEXT NOT NULL,           -- ISO code (en, es, fr, de, ja, ar)
  participant_name TEXT NOT NULL,   -- Usually "Teacher" or actual teacher name

  -- Timing (relative to recording start)
  timestamp_ms INTEGER NOT NULL,    -- Milliseconds from recording start

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_translation_entries_recording_id ON translation_entries(recording_id);
CREATE INDEX idx_translation_entries_timestamp ON translation_entries(recording_id, timestamp_ms);
CREATE INDEX idx_translation_entries_language ON translation_entries(language);

-- Composite index for playback queries (critical for performance)
CREATE INDEX idx_translation_playback ON translation_entries(recording_id, language, timestamp_ms);
```

### Row-Level Security (Optional but Recommended)

```sql
-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_entries ENABLE ROW LEVEL SECURITY;

-- Public read access (adjust based on your auth needs)
CREATE POLICY "Recordings are viewable by everyone"
  ON recordings FOR SELECT
  USING (true);

CREATE POLICY "Translation entries are viewable by everyone"
  ON translation_entries FOR SELECT
  USING (true);

-- Only authenticated users can insert/update/delete (adjust for your auth)
-- Example if using Supabase Auth:
-- CREATE POLICY "Only teachers can create recordings"
--   ON recordings FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
```

---

## Storage Configuration

### S3 / Cloudflare R2 Setup

**Recommended: Cloudflare R2** (S3-compatible, cheaper bandwidth)
- Free tier: 10 GB storage, 10 million reads/month
- No egress fees (vs AWS S3 charges for downloads)

#### Environment Variables to Add

```env
# S3 / R2 Storage Configuration
S3_ACCESS_KEY=your-r2-access-key
S3_SECRET_KEY=your-r2-secret-key
S3_BUCKET=livekit-recordings
S3_REGION=auto                    # For R2, use "auto"
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true         # Required for R2

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Bucket Structure
```
livekit-recordings/
├── MATH101/
│   ├── MATH101_2025-01-30_14-30/
│   │   ├── index.m3u8              # HLS playlist
│   │   ├── segment_0.ts            # Video segments
│   │   ├── segment_1.ts
│   │   └── session.mp4             # Optional MP4
│   └── MATH101_2025-01-31_10-00/
│       └── ...
└── PHYS202/
    └── ...
```

---

## Implementation Phases

### Phase 0: Prerequisites (Complete First)

**Before starting recording implementation:**
1. ✅ Supabase project created
2. ✅ Database tables created (schema above)
3. ✅ S3/R2 bucket created and credentials obtained
4. ✅ Environment variables added to `.env.local`
5. ✅ Supabase client installed and configured

---

### Phase 1: Database & Utilities

**Goal**: Setup database client and helper functions

#### 1.1 Install Dependencies
```bash
pnpm add @supabase/supabase-js hls.js
pnpm add -D @types/hls.js
```

#### 1.2 Create Supabase Client
**File**: `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for privileged operations)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

#### 1.3 Create Recording Utility Functions
**File**: `lib/recording-utils.ts`

```typescript
import { supabaseAdmin } from './supabase';

export interface Recording {
  id: string;
  room_sid: string;
  room_name: string;
  session_id: string;
  egress_id: string;
  hls_playlist_url: string | null;
  mp4_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  teacher_name: string;
  started_at: string;
  ended_at: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

export interface TranslationEntry {
  id: string;
  recording_id: string;
  text: string;
  language: string;
  participant_name: string;
  timestamp_ms: number;
  created_at: string;
}

/**
 * Generate unique session ID for recording
 * Format: ROOMCODE_YYYY-MM-DD_HH-MM
 */
export function generateSessionId(roomName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-'); // HH-MM
  return `${roomName}_${date}_${time}`;
}

/**
 * Create recording record in database
 */
export async function createRecording(params: {
  roomSid: string;
  roomName: string;
  sessionId: string;
  egressId: string;
  teacherName: string;
}): Promise<Recording> {
  const { data, error } = await supabaseAdmin
    .from('recordings')
    .insert({
      room_sid: params.roomSid,
      room_name: params.roomName,
      session_id: params.sessionId,
      egress_id: params.egressId,
      teacher_name: params.teacherName,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create recording: ${error.message}`);
  return data;
}

/**
 * Update recording with egress results
 */
export async function updateRecording(
  recordingId: string,
  updates: Partial<Recording>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('recordings')
    .update(updates)
    .eq('id', recordingId);

  if (error) throw new Error(`Failed to update recording: ${error.message}`);
}

/**
 * Get recording by ID
 */
export async function getRecording(recordingId: string): Promise<Recording | null> {
  const { data, error } = await supabaseAdmin
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get recording: ${error.message}`);
  }
  return data;
}

/**
 * Get recordings for a room
 */
export async function getRoomRecordings(roomName: string): Promise<Recording[]> {
  const { data, error } = await supabaseAdmin
    .from('recordings')
    .select('*')
    .eq('room_name', roomName)
    .order('started_at', { ascending: false });

  if (error) throw new Error(`Failed to get recordings: ${error.message}`);
  return data || [];
}

/**
 * Save translation entry during live session
 */
export async function saveTranslationEntry(params: {
  recordingId: string;
  text: string;
  language: string;
  participantName: string;
  timestampMs: number;
}): Promise<TranslationEntry> {
  const { data, error } = await supabaseAdmin
    .from('translation_entries')
    .insert({
      recording_id: params.recordingId,
      text: params.text,
      language: params.language,
      participant_name: params.participantName,
      timestamp_ms: params.timestampMs,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save translation: ${error.message}`);
  return data;
}

/**
 * Get translations for playback (filtered by language and time range)
 */
export async function getRecordingTranslations(
  recordingId: string,
  language?: string
): Promise<TranslationEntry[]> {
  let query = supabaseAdmin
    .from('translation_entries')
    .select('*')
    .eq('recording_id', recordingId)
    .order('timestamp_ms', { ascending: true });

  if (language) {
    query = query.eq('language', language);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get translations: ${error.message}`);
  return data || [];
}
```

#### 1.4 Update Types
**File**: `lib/types.ts` (add to existing file)

```typescript
// Add to existing types.ts

export interface RecordingMetadata {
  recordingId: string;
  sessionId: string;
  startTime: number; // Unix timestamp in ms
  isRecording: boolean;
}

export interface TranslationCardWithTime {
  id: string;
  text: string;
  language: string;
  participantName: string;
  timestampMs: number;
  displayTime: string; // Formatted time (e.g., "1:23")
}
```

---

### Phase 2: Recording Initialization API

**Goal**: Create API to start Track Composite Egress

#### 2.1 Start Recording Endpoint
**File**: `app/api/recordings/start/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { EgressClient, TrackCompositeEgressRequest, EncodedFileOutput, SegmentedFileOutput, EncodedFileType, SegmentedFileProtocol } from 'livekit-server-sdk';
import { createRecording, generateSessionId } from '@/lib/recording-utils';

const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;

const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY!;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY!;
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_REGION = process.env.S3_REGION!;
const S3_ENDPOINT = process.env.S3_ENDPOINT!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, roomSid, teacherName, audioTrackId, videoTrackId } = body;

    // Validate required fields
    if (!roomName || !roomSid || !teacherName) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, roomSid, teacherName' },
        { status: 400 }
      );
    }

    // Generate unique session ID
    const sessionId = generateSessionId(roomName);
    const s3Prefix = `${roomName}/${sessionId}/`;

    // Initialize LiveKit Egress client
    const egressClient = new EgressClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Configure S3 upload
    const s3Config = {
      accessKey: S3_ACCESS_KEY,
      secret: S3_SECRET_KEY,
      bucket: S3_BUCKET,
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: true,
    };

    // HLS output (primary - for streaming playback)
    const hlsOutput: SegmentedFileOutput = {
      filenamePrefix: s3Prefix,
      playlistName: 'index.m3u8',
      segmentDuration: 6, // 6-second segments (good balance)
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      output: {
        case: 's3',
        value: s3Config,
      },
    };

    // MP4 output (optional - for downloads)
    const mp4Output: EncodedFileOutput = {
      fileType: EncodedFileType.MP4,
      filepath: `${s3Prefix}session.mp4`,
      output: {
        case: 's3',
        value: s3Config,
      },
    };

    // Start Track Composite Egress
    const egressRequest = {
      roomName: roomName,
      audioTrackId: audioTrackId, // Can be undefined for mixed room audio
      videoTrackId: videoTrackId, // Teacher's video track
      segments: hlsOutput,
      file: mp4Output, // Optional: comment out if only HLS needed
      preset: 'H264_1080P_30', // Or H264_720P_30 for smaller files
    };

    const egressInfo = await egressClient.startTrackCompositeEgress(egressRequest);

    // Create database record
    const recording = await createRecording({
      roomSid,
      roomName,
      sessionId,
      egressId: egressInfo.egressId,
      teacherName,
    });

    return NextResponse.json({
      success: true,
      recording: {
        id: recording.id,
        sessionId: recording.session_id,
        egressId: recording.egress_id,
        status: recording.status,
        startedAt: recording.started_at,
      },
    });
  } catch (error) {
    console.error('Failed to start recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

#### 2.2 Stop Recording Endpoint
**File**: `app/api/recordings/stop/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { updateRecording, getRecording } from '@/lib/recording-utils';

const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, egressId } = body;

    if (!recordingId || !egressId) {
      return NextResponse.json(
        { error: 'Missing required fields: recordingId, egressId' },
        { status: 400 }
      );
    }

    // Verify recording exists
    const recording = await getRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Stop egress via LiveKit API
    const egressClient = new EgressClient(LIVEKIT_URL, API_KEY, API_SECRET);
    await egressClient.stopEgress(egressId);

    // Update database (webhook will set final status)
    await updateRecording(recordingId, {
      ended_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Recording stopped',
    });
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: Translation Capture

**Goal**: Save translation entries to database during live session

#### 3.1 Translation Save Endpoint
**File**: `app/api/recordings/translations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { saveTranslationEntry } from '@/lib/recording-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, text, language, participantName, timestampMs } = body;

    // Validate required fields
    if (!recordingId || !text || !language || !participantName || timestampMs === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save translation entry
    const entry = await saveTranslationEntry({
      recordingId,
      text,
      language,
      participantName,
      timestampMs,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        timestampMs: entry.timestamp_ms,
      },
    });
  } catch (error) {
    console.error('Failed to save translation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Batch endpoint (optional - for efficiency)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entries } = body; // Array of translation entries

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Invalid entries array' },
        { status: 400 }
      );
    }

    // Save all entries
    const results = await Promise.all(
      entries.map(entry => saveTranslationEntry(entry))
    );

    return NextResponse.json({
      success: true,
      count: results.length,
    });
  } catch (error) {
    console.error('Failed to batch save translations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

#### 3.2 Modify TranslationPanel to Capture
**File**: `app/components/TranslationPanel.tsx` (modify existing)

Add recording capture logic:

```typescript
// Add near top of component
interface TranslationPanelProps {
  captionsLanguage: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  // NEW: Recording props
  recordingMetadata?: RecordingMetadata | null;
}

export default function TranslationPanel({
  captionsLanguage,
  onClose,
  showCloseButton = false,
  recordingMetadata // NEW
}: TranslationPanelProps) {
  // ... existing code ...

  // NEW: Add translation capture effect
  useEffect(() => {
    if (!recordingMetadata?.isRecording) return;

    const saveTranslation = async (entry: TranslationEntry) => {
      try {
        const timestampMs = Date.now() - recordingMetadata.startTime;

        await fetch('/api/recordings/translations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordingId: recordingMetadata.recordingId,
            text: entry.text,
            language: entry.language,
            participantName: entry.participantName || 'Teacher',
            timestampMs,
          }),
        });
      } catch (error) {
        console.error('Failed to save translation:', error);
      }
    };

    // Save each new translation
    if (translations.length > 0) {
      const latestTranslation = translations[translations.length - 1];
      saveTranslation(latestTranslation);
    }
  }, [translations, recordingMetadata]);

  // ... rest of existing code ...
}
```

---

### Phase 4: Webhook Handler

**Goal**: Handle LiveKit egress events to update recording status

#### 4.1 Egress Webhook Endpoint
**File**: `app/api/webhooks/egress/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { updateRecording, getRecording } from '@/lib/recording-utils';

const S3_ENDPOINT = process.env.S3_ENDPOINT!;
const S3_BUCKET = process.env.S3_BUCKET!;

export async function POST(request: NextRequest) {
  try {
    const event = await request.json();

    console.log('Egress webhook received:', event);

    const { egressInfo } = event;
    if (!egressInfo) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const { egressId, status, roomName, startedAt, endedAt, duration, fileResults } = egressInfo;

    // Find recording by egress ID
    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('egress_id', egressId)
      .single();

    if (!recordings) {
      console.warn(`Recording not found for egress ID: ${egressId}`);
      return NextResponse.json({ message: 'Recording not found' }, { status: 404 });
    }

    // Handle different event types
    switch (status) {
      case 'EGRESS_STARTING':
        await updateRecording(recordings.id, {
          status: 'ACTIVE',
        });
        break;

      case 'EGRESS_ACTIVE':
        // Optional: update with intermediate info
        break;

      case 'EGRESS_ENDING':
      case 'EGRESS_COMPLETE':
        // Extract file URLs from results
        let hlsUrl = null;
        let mp4Url = null;
        let totalSize = 0;

        if (fileResults && fileResults.length > 0) {
          fileResults.forEach((result: any) => {
            if (result.filename?.endsWith('.m3u8')) {
              hlsUrl = constructS3Url(result.filename);
            } else if (result.filename?.endsWith('.mp4')) {
              mp4Url = constructS3Url(result.filename);
            }
            totalSize += result.size || 0;
          });
        }

        await updateRecording(recordings.id, {
          status: 'COMPLETED',
          ended_at: new Date(endedAt).toISOString(),
          hls_playlist_url: hlsUrl,
          mp4_url: mp4Url,
          duration_seconds: Math.floor((duration || 0) / 1000),
          file_size_bytes: totalSize,
        });
        break;

      case 'EGRESS_FAILED':
        await updateRecording(recordings.id, {
          status: 'FAILED',
          ended_at: new Date().toISOString(),
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Construct full S3 URL from filename
 */
function constructS3Url(filename: string): string {
  // For Cloudflare R2
  if (S3_ENDPOINT.includes('r2.cloudflarestorage.com')) {
    // Use public R2 URL format: https://pub-xxxxx.r2.dev/filename
    // You'll need to setup R2 custom domain or public bucket
    return `${S3_ENDPOINT}/${S3_BUCKET}/${filename}`;
  }

  // For AWS S3
  return `https://${S3_BUCKET}.s3.amazonaws.com/${filename}`;
}
```

#### 4.2 Configure Webhook in LiveKit Cloud
1. Go to LiveKit Cloud Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/egress`
3. Enable events: `egress_started`, `egress_updated`, `egress_ended`
4. Save webhook secret (for signature verification - optional but recommended)

---

### Phase 5: Playback UI

**Goal**: Create video player with translation card overlay

#### 5.1 Recordings List Page
**File**: `app/recordings/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Download, Trash2, Clock, Calendar } from 'lucide-react';
import { Recording } from '@/lib/recording-utils';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch('/api/recordings');
      const data = await response.json();
      setRecordings(data.recordings || []);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Delete this recording? This cannot be undone.')) return;

    try {
      await fetch(`/api/recordings/${recordingId}`, { method: 'DELETE' });
      fetchRecordings(); // Refresh list
    } catch (error) {
      console.error('Failed to delete recording:', error);
      alert('Failed to delete recording');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Loading recordings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Session Recordings</h1>
        <p className="text-muted-foreground mt-2">
          View and manage your classroom recordings
        </p>
      </div>

      {recordings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No recordings yet. Start recording a session to see it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card key={recording.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{recording.room_name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    recording.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' :
                    recording.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {recording.status}
                  </span>
                </CardTitle>
                <CardDescription>{recording.teacher_name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(recording.started_at)}</span>
                  </div>
                  {recording.duration_seconds && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(recording.duration_seconds)}</span>
                    </div>
                  )}
                </div>

                {recording.status === 'COMPLETED' && recording.hls_playlist_url && (
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/recordings/${recording.id}`}>
                        <Play className="h-4 w-4 mr-2" />
                        Watch
                      </Link>
                    </Button>
                    {recording.mp4_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={recording.mp4_url} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(recording.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 5.2 Playback Page
**File**: `app/recordings/[recordingId]/page.tsx`

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import { Recording, TranslationEntry } from '@/lib/recording-utils';
import TranslationOverlay from '@/components/recordings/TranslationOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PreJoinLanguageSelect from '@/app/components/PreJoinLanguageSelect';

export default function RecordingPlaybackPage() {
  const params = useParams();
  const recordingId = params.recordingId as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recording details
  useEffect(() => {
    const fetchRecording = async () => {
      try {
        const response = await fetch(`/api/recordings/${recordingId}`);
        if (!response.ok) throw new Error('Recording not found');

        const data = await response.json();
        setRecording(data.recording);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId]);

  // Fetch translations when language changes
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const response = await fetch(
          `/api/recordings/${recordingId}/translations?language=${selectedLanguage}`
        );
        const data = await response.json();
        setTranslations(data.translations || []);
      } catch (err) {
        console.error('Failed to load translations:', err);
      }
    };

    if (recording) {
      fetchTranslations();
    }
  }, [recordingId, selectedLanguage, recording]);

  // Initialize HLS player
  useEffect(() => {
    if (!recording?.hls_playlist_url || !videoRef.current) return;

    const video = videoRef.current;

    // iOS Safari supports HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = recording.hls_playlist_url;
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers
      const hls = new Hls();
      hls.loadSource(recording.hls_playlist_url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          setError('Failed to load video');
        }
      });
    } else {
      setError('HLS playback not supported in this browser');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [recording]);

  // Track video time for translation sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime * 1000); // Convert to milliseconds
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleTimeUpdate);
    };
  }, []);

  const handleSeekToTranslation = (timestampMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampMs / 1000;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Loading recording...</p>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-8 text-center">
          <p className="text-red-500">{error || 'Recording not found'}</p>
          <Button asChild className="mt-4">
            <a href="/recordings">Back to Recordings</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{recording.room_name}</h1>
        <p className="text-muted-foreground">
          {recording.teacher_name} • {new Date(recording.started_at).toLocaleString()}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <video
              ref={videoRef}
              controls
              className="w-full aspect-video bg-black"
              playsInline
            >
              Your browser does not support video playback.
            </video>
          </Card>

          {/* Language Selector */}
          <div className="mt-4">
            <label className="text-sm font-medium mb-2 block">
              Translation Language
            </label>
            <PreJoinLanguageSelect
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              isTeacher={false}
            />
          </div>
        </div>

        {/* Translation Overlay */}
        <div className="lg:col-span-1">
          <TranslationOverlay
            translations={translations}
            currentTimeMs={currentTime}
            onSeek={handleSeekToTranslation}
          />
        </div>
      </div>
    </div>
  );
}
```

#### 5.3 Translation Overlay Component
**File**: `components/recordings/TranslationOverlay.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TranslationEntry } from '@/lib/recording-utils';
import { Languages } from 'lucide-react';

interface TranslationOverlayProps {
  translations: TranslationEntry[];
  currentTimeMs: number;
  onSeek?: (timestampMs: number) => void;
}

export default function TranslationOverlay({
  translations,
  currentTimeMs,
  onSeek,
}: TranslationOverlayProps) {
  // Get translations within 5-second window of current time
  const visibleTranslations = useMemo(() => {
    const windowMs = 5000; // 5 seconds
    return translations.filter(
      (t) =>
        t.timestamp_ms >= currentTimeMs - windowMs &&
        t.timestamp_ms <= currentTimeMs + windowMs
    );
  }, [translations, currentTimeMs]);

  // Get all past translations for scrollable list
  const pastTranslations = useMemo(() => {
    return translations.filter((t) => t.timestamp_ms <= currentTimeMs);
  }, [translations, currentTimeMs]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Translations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Current visible translations (large) */}
        {visibleTranslations.length > 0 && (
          <div className="mb-6 space-y-3">
            {visibleTranslations.map((translation) => (
              <div
                key={translation.id}
                className="p-4 bg-primary/10 rounded-lg border-l-4 border-primary"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {translation.participant_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(translation.timestamp_ms)}
                  </span>
                </div>
                <p className="text-sm">{translation.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Past translations (scrollable) */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            All Translations ({pastTranslations.length})
          </p>
          {pastTranslations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No translations yet
            </p>
          ) : (
            pastTranslations.map((translation) => (
              <button
                key={translation.id}
                onClick={() => onSeek?.(translation.timestamp_ms)}
                className="w-full text-left p-3 rounded hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {formatTime(translation.timestamp_ms)}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">{translation.text}</p>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 5.4 Recording Management API
**File**: `app/api/recordings/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName');

    let query = supabaseAdmin
      .from('recordings')
      .select('*')
      .order('started_at', { ascending: false });

    if (roomName) {
      query = query.eq('room_name', roomName);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({
      recordings: data || [],
    });
  } catch (error) {
    console.error('Failed to fetch recordings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/recordings/[recordingId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRecording } from '@/lib/recording-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  try {
    const recording = await getRecording(params.recordingId);

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('Failed to get recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  try {
    // TODO: Also delete S3 files here
    // const recording = await getRecording(params.recordingId);
    // Delete from S3 bucket...

    // Delete from database (cascade will delete translation_entries)
    const { error } = await supabaseAdmin
      .from('recordings')
      .delete()
      .eq('id', params.recordingId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      message: 'Recording deleted',
    });
  } catch (error) {
    console.error('Failed to delete recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/recordings/[recordingId]/translations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRecordingTranslations } from '@/lib/recording-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  try {
    const language = request.nextUrl.searchParams.get('language') || undefined;

    const translations = await getRecordingTranslations(
      params.recordingId,
      language
    );

    return NextResponse.json({
      translations,
    });
  } catch (error) {
    console.error('Failed to fetch translations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 6: Recording Controls (Teacher UI)

**Goal**: Add recording controls to classroom interface

#### 6.1 Recording Controls Component
**File**: `components/recordings/RecordingControls.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Circle, Square, Loader2 } from 'lucide-react';
import { RecordingMetadata } from '@/lib/types';

interface RecordingControlsProps {
  roomName: string;
  roomSid: string;
  teacherName: string;
  onRecordingStart: (metadata: RecordingMetadata) => void;
  onRecordingStop: () => void;
}

export default function RecordingControls({
  roomName,
  roomSid,
  teacherName,
  onRecordingStart,
  onRecordingStop,
}: RecordingControlsProps) {
  const [recording, setRecording] = useState<RecordingMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recordings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          roomSid,
          teacherName,
          // audioTrackId and videoTrackId can be added here if needed
        }),
      });

      if (!response.ok) throw new Error('Failed to start recording');

      const data = await response.json();
      const metadata: RecordingMetadata = {
        recordingId: data.recording.id,
        sessionId: data.recording.sessionId,
        startTime: Date.now(),
        isRecording: true,
      };

      setRecording(metadata);
      onRecordingStart(metadata);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording');
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    setLoading(true);
    try {
      const response = await fetch('/api/recordings/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: recording.recordingId,
          egressId: recording.sessionId, // Adjust if you store egressId separately
        }),
      });

      if (!response.ok) throw new Error('Failed to stop recording');

      setRecording(null);
      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <Button
          onClick={handleStartRecording}
          disabled={loading}
          variant="default"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Circle className="h-4 w-4 mr-2 fill-red-500 text-red-500" />
          )}
          Start Recording
        </Button>
      ) : (
        <Button
          onClick={handleStopRecording}
          disabled={loading}
          variant="destructive"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Square className="h-4 w-4 mr-2" />
          )}
          Stop Recording
        </Button>
      )}

      {recording && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-500 font-medium">REC</span>
        </div>
      )}
    </div>
  );
}
```

#### 6.2 Integrate into Classroom Client
**File**: `app/rooms/[roomName]/PageClientImpl.tsx` (modify existing)

Add recording state and pass to components:

```typescript
// Add near top of component
const [recordingMetadata, setRecordingMetadata] = useState<RecordingMetadata | null>(null);

// Add recording controls to teacher UI (in the return JSX)
{classroomInfo?.role === 'teacher' && (
  <RecordingControls
    roomName={roomName}
    roomSid={room?.sid || ''}
    teacherName={preJoinDefaults.username}
    onRecordingStart={setRecordingMetadata}
    onRecordingStop={() => setRecordingMetadata(null)}
  />
)}

// Pass recording metadata to TranslationPanel
<TranslationPanel
  captionsLanguage={selectedLanguage}
  recordingMetadata={recordingMetadata}
  // ... other props
/>
```

---

### Phase 7: Recording Management UI

**Goal**: Add recordings tab to room management page

#### 7.1 Add Recordings Link to Navigation
**File**: `app/manage-rooms/page.tsx` (modify existing)

Add link to recordings page:

```typescript
// Add button in header
<div className="flex items-center gap-4">
  <Button asChild variant="outline">
    <Link href="/recordings">
      <Play className="h-4 w-4 mr-2" />
      View Recordings
    </Link>
  </Button>
  <Button onClick={() => setShowCreateDialog(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Create Room
  </Button>
</div>
```

#### 7.2 Add Recordings Count to Room Cards
**File**: `components/rooms/RoomCard.tsx` (modify existing)

Add recordings count display:

```typescript
// Fetch recordings count
const [recordingsCount, setRecordingsCount] = useState<number>(0);

useEffect(() => {
  const fetchCount = async () => {
    try {
      const response = await fetch(`/api/recordings?roomName=${room.name}`);
      const data = await response.json();
      setRecordingsCount(data.recordings?.length || 0);
    } catch (error) {
      console.error('Failed to fetch recordings count:', error);
    }
  };
  fetchCount();
}, [room.name]);

// Add to card footer
<CardFooter>
  <div className="text-sm text-muted-foreground">
    {recordingsCount} recording{recordingsCount !== 1 ? 's' : ''}
  </div>
</CardFooter>
```

---

## Files Summary

### Files to Create (16 new files)

#### Database & Utilities (2 files)
1. `lib/supabase.ts` - Supabase client singleton
2. `lib/recording-utils.ts` - Recording helper functions

#### API Routes (8 files)
3. `app/api/recordings/start/route.ts` - Start recording endpoint
4. `app/api/recordings/stop/route.ts` - Stop recording endpoint
5. `app/api/recordings/route.ts` - List recordings endpoint
6. `app/api/recordings/[recordingId]/route.ts` - Get/delete recording
7. `app/api/recordings/[recordingId]/translations/route.ts` - Get translations for playback
8. `app/api/recordings/translations/route.ts` - Save translation during live session
9. `app/api/webhooks/egress/route.ts` - Egress event webhook handler
10. *(Optional)* `app/api/recordings/batch-translations/route.ts` - Batch translation save

#### UI Pages (2 files)
11. `app/recordings/page.tsx` - Recordings list page
12. `app/recordings/[recordingId]/page.tsx` - Playback page with HLS player

#### UI Components (4 files)
13. `components/recordings/RecordingControls.tsx` - Start/stop recording buttons
14. `components/recordings/TranslationOverlay.tsx` - Translation cards overlay for playback
15. *(Optional)* `components/recordings/RecordingCard.tsx` - Recording list item card
16. *(Optional)* `components/recordings/VideoPlayer.tsx` - Standalone HLS video player component

### Files to Modify (5 files)

1. **`lib/types.ts`**
   - Add `RecordingMetadata`, `TranslationCardWithTime` interfaces

2. **`app/rooms/[roomName]/PageClientImpl.tsx`**
   - Add recording state management
   - Integrate RecordingControls component
   - Pass recording metadata to TranslationPanel

3. **`app/components/TranslationPanel.tsx`**
   - Add translation capture logic when recording is active
   - Send translations to API with timestamps

4. **`app/manage-rooms/page.tsx`**
   - Add link to recordings page
   - Show recordings count per room

5. **`.env.example`**
   - Add S3/R2 storage configuration
   - Add Supabase configuration

### Dependencies to Add

```bash
pnpm add @supabase/supabase-js hls.js
pnpm add -D @types/hls.js
```

---

## Testing Guide

### Phase 1: Database & API Testing

**1. Test Recording Start**
```bash
curl -X POST http://localhost:3000/api/recordings/start \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "TEST101",
    "roomSid": "RM_test123",
    "teacherName": "Dr. Test"
  }'
```

Expected: Returns `recording` object with `id`, `sessionId`, `egressId`, `status: "ACTIVE"`

**2. Test Translation Save**
```bash
curl -X POST http://localhost:3000/api/recordings/translations \
  -H "Content-Type: application/json" \
  -d '{
    "recordingId": "<recording-id>",
    "text": "Hello students",
    "language": "en",
    "participantName": "Dr. Test",
    "timestampMs": 5000
  }'
```

Expected: Returns `entry` object with `id`, `timestampMs`

### Phase 2: Live Recording Test

**1. Start Classroom Session as Teacher**
- Navigate to `/rooms/TEST101?classroom=true&role=teacher`
- Join with camera/mic enabled
- Click "Start Recording"
- Verify recording indicator appears

**2. Generate Translations**
- Speak into microphone (if translation agent is running)
- Or manually trigger translation events
- Verify translations appear in sidebar

**3. Check Database**
```sql
-- Check recording created
SELECT * FROM recordings WHERE room_name = 'TEST101' ORDER BY started_at DESC LIMIT 1;

-- Check translations saved
SELECT COUNT(*) FROM translation_entries WHERE recording_id = '<recording-id>';
```

**4. Stop Recording**
- Click "Stop Recording"
- Wait 30-60 seconds for egress to complete
- Check LiveKit Cloud Dashboard → Egress section for status

### Phase 3: Webhook & Egress Test

**1. Monitor Webhook Logs**
```bash
# In your deployment logs
tail -f /var/log/app.log | grep "Egress webhook"
```

**2. Check Egress Completion**
- After stopping recording, wait for `egress_ended` webhook
- Verify database updated:
```sql
SELECT status, hls_playlist_url, mp4_url, duration_seconds
FROM recordings
WHERE session_id = '<session-id>';
```

Expected: `status = "COMPLETED"`, URLs populated, duration set

**3. Verify S3/R2 Files**
```bash
# List bucket contents (using AWS CLI or R2 dashboard)
aws s3 ls s3://livekit-recordings/TEST101/
```

Expected: See `.m3u8` playlist and `.ts` segment files

### Phase 4: Playback Test

**1. Navigate to Recordings List**
- Go to `/recordings`
- Verify TEST101 recording appears
- Check status badge shows "COMPLETED"

**2. Open Playback Page**
- Click "Watch" button
- Verify video loads and plays
- Verify HLS streaming works (no buffering issues)

**3. Test Translation Sync**
- Select different language from dropdown
- Verify translation cards appear at correct timestamps
- Pause video → verify cards freeze
- Seek to different time → verify cards update

**4. Test Click-to-Seek**
- Click on a translation card in the sidebar
- Verify video seeks to that timestamp
- Verify translation card highlights

### Phase 5: Edge Cases

**1. Test Recording Failure Recovery**
- Start recording
- Stop LiveKit Cloud egress manually (via dashboard)
- Verify webhook marks recording as "FAILED"
- Verify UI handles failed recording gracefully

**2. Test Multiple Concurrent Recordings**
- Start recordings in 2 different rooms
- Verify both egress jobs run simultaneously
- Verify translations saved to correct recording

**3. Test Long Session**
- Record 10+ minute session
- Verify HLS segments created correctly
- Verify seeking works across entire duration
- Check file sizes are reasonable

**4. Test No Translations**
- Record session with no translations
- Verify playback works without translation data
- Verify UI shows "No translations" message

---

## Technical Implementation Details

### HLS Playlist Structure

**index.m3u8** (Master playlist):
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.0,
segment_0.ts
#EXTINF:6.0,
segment_1.ts
...
#EXT-X-ENDLIST
```

### Timestamp Calculation

**Recording Start Time**:
```typescript
const recordingStartTime = Date.now(); // When egress starts
```

**Translation Timestamp**:
```typescript
const translationTimestamp = Date.now() - recordingStartTime; // Milliseconds
```

**Playback Sync**:
```typescript
const videoTimeMs = videoElement.currentTime * 1000;
const activeTranslations = translations.filter(
  t => Math.abs(t.timestamp_ms - videoTimeMs) < 5000 // 5-second window
);
```

### S3 URL Signing (Optional)

For private recordings, generate signed URLs:

```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function getSignedPlaylistUrl(key: string): Promise<string> {
  const client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
  });

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour
}
```

### Performance Optimizations

**1. Translation Query Optimization**
```sql
-- Use composite index for fast lookups
CREATE INDEX idx_translation_playback
ON translation_entries(recording_id, language, timestamp_ms);

-- Query only needed time range (if video is at 2:30)
SELECT * FROM translation_entries
WHERE recording_id = '<id>'
  AND language = 'en'
  AND timestamp_ms BETWEEN 140000 AND 160000  -- 2:20 to 2:40
ORDER BY timestamp_ms ASC;
```

**2. HLS Segment Caching**
- Use CDN (Cloudflare, CloudFront) in front of S3/R2
- Cache segments for 1 year (immutable after recording ends)
- Cache playlist for 5 minutes (in case of updates)

**3. Translation Batching**
```typescript
// Batch translations every 5 seconds instead of real-time
const translationQueue: TranslationEntry[] = [];

const flushQueue = async () => {
  if (translationQueue.length === 0) return;

  await fetch('/api/recordings/batch-translations', {
    method: 'POST',
    body: JSON.stringify({ entries: translationQueue }),
  });

  translationQueue.length = 0;
};

setInterval(flushQueue, 5000); // Flush every 5 seconds
```

---

## Troubleshooting Guide

### Issue: Recording fails to start

**Symptoms**: API returns error, no egress created

**Checks**:
1. Verify S3/R2 credentials are correct
2. Check bucket exists and has write permissions
3. Verify LiveKit API key/secret are valid
4. Check LiveKit Cloud dashboard for egress errors

**Solution**:
```bash
# Test S3 connection
aws s3 ls s3://your-bucket --endpoint-url=<S3_ENDPOINT>

# Check LiveKit credentials
curl -X POST https://your-project.livekit.cloud/twirp/livekit.RoomService/ListRooms \
  -H "Authorization: Bearer <JWT>" \
  -d '{}'
```

### Issue: Webhook not receiving events

**Symptoms**: Recording stays "ACTIVE" forever, no URLs populated

**Checks**:
1. Verify webhook URL is publicly accessible
2. Check LiveKit Cloud webhook configuration
3. Review webhook endpoint logs

**Solution**:
- Use ngrok for local testing: `ngrok http 3000`
- Update LiveKit Cloud webhook URL to ngrok URL
- Check webhook signature verification (if enabled)

### Issue: Video won't play

**Symptoms**: HLS player shows error, video element blank

**Checks**:
1. Verify HLS playlist URL is accessible (open in browser)
2. Check CORS headers on S3/R2 bucket
3. Verify browser supports HLS (or hls.js loaded)

**Solution**:
```javascript
// Add CORS to S3/R2 bucket
{
  "AllowedOrigins": ["https://your-domain.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}
```

### Issue: Translations not syncing

**Symptoms**: Cards appear at wrong times, missing translations

**Checks**:
1. Verify `timestamp_ms` is relative to recording start
2. Check database query filters by correct `recording_id`
3. Verify video `currentTime` conversion to milliseconds

**Solution**:
```typescript
// Ensure consistent timestamp calculation
const recordingStartTime = Date.now(); // Store when recording starts
const timestampMs = Date.now() - recordingStartTime; // Always relative
```

---

## Cost Estimates

### Supabase (Free Tier)
- **Database**: 500 MB (enough for ~50,000 translation entries)
- **Bandwidth**: Unlimited
- **API Requests**: Unlimited
- **Cost**: $0/month

### Cloudflare R2 (Free Tier)
- **Storage**: 10 GB (~20 hours of 1080p HLS)
- **Reads**: 10 million requests/month
- **Writes**: 1 million requests/month
- **Egress**: FREE (no bandwidth charges)
- **Cost**: $0/month

### AWS S3 (If not using R2)
- **Storage**: $0.023/GB (~$0.46 for 20 GB)
- **Egress**: $0.09/GB (~$18 for 200 GB downloads)
- **Requests**: $0.0004 per 1,000 GET ($0.40 for 1M requests)
- **Cost**: ~$19/month for moderate usage

### LiveKit Cloud Egress
- **Track Composite**: ~$0.0040/minute
- **1 hour session**: ~$0.24
- **20 sessions/month**: ~$4.80/month

**Total Estimated Cost (Free Tiers)**: $5-10/month

---

## Next Steps After Implementation

### Phase 8: Advanced Features (Optional)

**1. Recording Search**
- Full-text search across translation content
- Filter by language, date range, teacher
- Jump to specific translation in video

**2. Recording Analytics**
- Track view counts per recording
- Most-watched segments
- Language preference statistics

**3. Recording Editing**
- Trim recordings (start/end times)
- Split long recordings into chapters
- Add bookmarks for key moments

**4. Multi-Track Recording**
- Record student video/audio separately
- Enable post-production mixing
- Create highlight reels

**5. Live Streaming**
- Stream recording to YouTube/Twitch simultaneously
- Enable live Q&A during playback
- Add live captions during stream

---

## Document Metadata

**Version**: 1.0
**Last Updated**: 2025-01-30
**Status**: Ready for Implementation
**Prerequisites**: Supabase integration complete
**Estimated Implementation Time**: 2-3 days
**Estimated Testing Time**: 1 day

---

## Quick Start Checklist

Before starting implementation, ensure:

- [ ] Supabase project created
- [ ] Database tables created (run SQL schema)
- [ ] S3/R2 bucket created
- [ ] S3/R2 credentials obtained
- [ ] LiveKit webhook configured
- [ ] Environment variables added to `.env.local`
- [ ] Dependencies installed (`@supabase/supabase-js`, `hls.js`)

**Then proceed with Phase 1!** 🚀