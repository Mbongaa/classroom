# Persistent Rooms Implementation Plan

> **Feature**: Add Zoom-like persistent, reusable room codes for recurring lectures using LiveKit's native metadata system (no external database required for MVP).

---

## ✅ Implementation Status: COMPLETE

**Implementation Date**: January 30, 2025

This document served as the planning blueprint for the persistent rooms feature. The feature has been fully implemented and is production-ready.

**📄 See Complete Implementation Details**: `PERSISTENT_ROOMS_IMPLEMENTATION.md`

### Key Achievements

- ✅ LiveKit metadata-only architecture (no external database)
- ✅ Room management UI with create, list, delete operations
- ✅ Auto-population of teacher name and language (teachers only)
- ✅ Support for meeting, classroom, and speech room types
- ✅ 7-day empty timeout for room persistence
- ✅ BigInt serialization handling
- ✅ Race condition fixes for async metadata loading

### Implementation Summary

- **9 new files created**: 4 API endpoints, 5 UI components
- **3 files modified**: Landing page, PageClientImpl, CustomPreJoin
- **2 dependencies added**: @radix-ui/react-dialog, @radix-ui/react-label

### Quick Links

- **API Documentation**: See "API Endpoints" section in `PERSISTENT_ROOMS_IMPLEMENTATION.md`
- **UI Components**: See "UI Components" section in `PERSISTENT_ROOMS_IMPLEMENTATION.md`
- **Testing Guide**: See "Testing Guide" section in `PERSISTENT_ROOMS_IMPLEMENTATION.md`
- **Technical Details**: See "Technical Details" section in `PERSISTENT_ROOMS_IMPLEMENTATION.md`

---

## Original Planning Document

The sections below represent the original planning and architectural analysis that guided the implementation.

---

## Table of Contents

1. [Business Value](#business-value)
2. [Architecture Analysis](#architecture-analysis)
3. [Technical Implementation](#technical-implementation)
4. [API Specifications](#api-specifications)
5. [UI/UX Components](#uiux-components)
6. [Room Metadata Schema](#room-metadata-schema)
7. [Implementation Phases](#implementation-phases)
8. [Edge Cases & Solutions](#edge-cases--solutions)
9. [Future Enhancements](#future-enhancements)
10. [Code Examples](#code-examples)

---

## Business Value

### Problem Statement

Currently, room IDs are randomly generated (e.g., `x7k2-m9p5`) for each session. Teachers and students need a new link every time, making recurring lectures inconvenient.

### Desired Solution

- Teachers create persistent rooms with memorable codes (e.g., `MATH101`)
- Same room code works for all lectures in a course
- Room stores teacher name, language, and configuration
- Students bookmark room link and reuse it throughout semester

### Use Cases

1. **Recurring Lectures**: Weekly Math 101 class uses same code
2. **Office Hours**: Professor has permanent office hour room
3. **Study Groups**: Student groups with consistent meeting spaces
4. **Speech Sessions**: Speakers with dedicated room codes

---

## Architecture Analysis

### LiveKit Room Lifecycle Deep Dive

#### Current Implementation (Ad-Hoc Rooms)

```
Landing Page → Generate Random ID → Navigate to /rooms/[randomId] →
Client Requests Token → Server Creates Token → Client Connects →
LiveKit Auto-Creates Room (implicit) → Session Starts →
All Leave → Room Auto-Deletes
```

**Characteristics**:

- Rooms created implicitly on first join
- No explicit room creation API call
- Auto-delete when empty (default 5 min)
- New room ID needed for each session

#### New Implementation (Persistent Rooms)

```
Teacher Dashboard → Create Room Form → API Call to RoomServiceClient.createRoom() →
Room Persists on LiveKit Server → Teacher Shares Code →
Students Join with Code → Token Generation (validates existence) →
Multiple Sessions Over Time → Manual Deletion Only
```

**Characteristics**:

- Rooms created explicitly via API
- Persist when empty (configurable timeout)
- Human-readable codes
- Reusable across sessions

### LiveKit Native Support Verified

✅ **Confirmed APIs** (from official docs):

```typescript
// 1. Create Room
RoomServiceClient.createRoom({
  name: string,
  emptyTimeout: number,     // seconds before auto-delete when empty
  maxParticipants: number,
  metadata: string          // 64 KiB JSON storage
})

// 2. List Rooms
RoomServiceClient.listRooms()

// 3. Delete Room
RoomServiceClient.deleteRoom(roomName: string)

// 4. Update Metadata
RoomServiceClient.updateRoomMetadata(roomName: string, metadata: string)
```

### Why Metadata-Only Architecture?

**Decision**: Use LiveKit metadata for room configuration instead of external database

**Advantages**:

1. ✅ **Zero Infrastructure**: No database to setup/maintain
2. ✅ **Faster Development**: 5-8 days vs 10-14 days
3. ✅ **Single Source of Truth**: Configuration lives with room
4. ✅ **Atomic Operations**: Updates are transactional
5. ✅ **Built-in Persistence**: LiveKit handles storage
6. ✅ **Sufficient Capacity**: 64 KiB per room (plenty for config)

**When to Add Database** (Phase 2):

- Complex queries (filter by teacher, language, date)
- User account system
- Session history and analytics
- Advanced scheduling features
- 100+ rooms with slow listing

---

## Technical Implementation

### System Components

#### 1. Backend (Next.js API Routes)

- `/api/rooms/create` - Create new persistent room
- `/api/rooms` - List all rooms
- `/api/rooms/[roomCode]` - Get/update/delete specific room
- `/api/connection-details` - Modified to validate room existence

#### 2. Frontend (React Components)

- `CreateRoomModal` - Form for room creation
- `RoomDashboard` - List and manage rooms
- `JoinByCodeInput` - Student join flow
- Updated landing page with new options

#### 3. LiveKit Integration

- `RoomServiceClient` - Server-side room management
- Metadata storage - Room configuration persistence
- Token generation - Validates room before issuing JWT

---

## API Specifications

### 1. POST /api/rooms/create

**Purpose**: Create new persistent room with configuration

**Request Body**:

```typescript
interface CreateRoomRequest {
  roomCode: string; // "MATH101" (4-20 chars, alphanumeric + hyphens)
  displayName: string; // "Mathematics 101"
  type: 'classroom' | 'speech';
  teacherName: string; // "Prof. Smith"
  teacherLanguage: string; // "en", "ar", "es", etc.
  maxParticipants?: number; // Default: 0 (unlimited)
  emptyTimeout?: number; // Seconds, default: 604800 (7 days)
  pin?: string; // Optional 4-6 digit PIN
}
```

**Response**:

```typescript
interface CreateRoomResponse {
  success: boolean;
  room: {
    name: string;
    sid: string;
    metadata: RoomMetadata;
    createdAt: number;
  };
  shareableLink: string; // "https://app.com/rooms/MATH101?classroom=true"
  studentLink: string; // "https://app.com/s/MATH101"
}
```

**Implementation**:

```typescript
export async function POST(request: NextRequest) {
  const body: CreateRoomRequest = await request.json();

  // 1. Validate room code format
  if (!/^[a-zA-Z0-9-]{4,20}$/.test(body.roomCode)) {
    return NextResponse.json({ error: 'Invalid room code format' }, { status: 400 });
  }

  // 2. Check uniqueness
  const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
  const existingRooms = await roomService.listRooms();

  if (existingRooms.some((r) => r.name.toLowerCase() === body.roomCode.toLowerCase())) {
    return NextResponse.json({ error: 'Room code already exists' }, { status: 409 });
  }

  // 3. Create room with metadata
  const metadata: RoomMetadata = {
    displayName: body.displayName,
    type: body.type,
    teacherName: body.teacherName,
    teacherLanguage: body.teacherLanguage,
    pin: body.pin,
    maxParticipants: body.maxParticipants || 0,
    createdAt: Date.now(),
  };

  const room = await roomService.createRoom({
    name: body.roomCode,
    emptyTimeout: body.emptyTimeout || 604800, // 7 days
    maxParticipants: body.maxParticipants || 0,
    metadata: JSON.stringify(metadata),
  });

  // 4. Generate shareable links
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const shareableLink = `${baseUrl}/rooms/${body.roomCode}?${body.type}=true&role=teacher`;
  const studentLink = `${baseUrl}/s/${body.roomCode}`;

  return NextResponse.json({
    success: true,
    room: {
      name: room.name,
      sid: room.sid,
      metadata,
      createdAt: Date.now(),
    },
    shareableLink,
    studentLink,
  });
}
```

**Error Codes**:

- `400` - Invalid request format
- `409` - Room code already exists
- `500` - Server error

---

### 2. GET /api/rooms

**Purpose**: List all persistent rooms

**Query Parameters**:

```typescript
{
  type?: "classroom" | "speech";  // Filter by type
  teacher?: string;                // Filter by teacher name
  limit?: number;                  // Max results (default: 100)
}
```

**Response**:

```typescript
interface ListRoomsResponse {
  rooms: Array<{
    name: string;
    sid: string;
    metadata: RoomMetadata;
    numParticipants: number;
    creationTime: number;
  }>;
  total: number;
}
```

**Implementation**:

```typescript
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const typeFilter = searchParams.get('type');
  const teacherFilter = searchParams.get('teacher');

  const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
  const allRooms = await roomService.listRooms();

  // Filter rooms based on metadata
  const filteredRooms = allRooms.filter((room) => {
    if (!room.metadata) return false;

    const metadata: RoomMetadata = JSON.parse(room.metadata);

    if (typeFilter && metadata.type !== typeFilter) return false;
    if (teacherFilter && !metadata.teacherName.toLowerCase().includes(teacherFilter.toLowerCase()))
      return false;

    return true;
  });

  return NextResponse.json({
    rooms: filteredRooms.map((room) => ({
      name: room.name,
      sid: room.sid,
      metadata: JSON.parse(room.metadata || '{}'),
      numParticipants: room.numParticipants,
      creationTime: room.creationTime,
    })),
    total: filteredRooms.length,
  });
}
```

---

### 3. GET /api/rooms/[roomCode]

**Purpose**: Get details of specific room

**Response**:

```typescript
interface GetRoomResponse {
  room: {
    name: string;
    sid: string;
    metadata: RoomMetadata;
    numParticipants: number;
    creationTime: number;
    activeParticipants?: Array<{
      identity: string;
      name: string;
      role: string;
    }>;
  };
}
```

**Implementation**:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;

  const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

  try {
    // List participants to verify room exists
    const participants = await roomService.listParticipants(roomCode);
    const rooms = await roomService.listRooms([roomCode]);

    if (rooms.length === 0) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    return NextResponse.json({
      room: {
        name: room.name,
        sid: room.sid,
        metadata: JSON.parse(room.metadata || '{}'),
        numParticipants: room.numParticipants,
        creationTime: room.creationTime,
        activeParticipants: participants.map((p) => ({
          identity: p.identity,
          name: p.name,
          role: JSON.parse(p.metadata || '{}').role || 'unknown',
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
}
```

---

### 4. DELETE /api/rooms/[roomCode]

**Purpose**: Delete persistent room

**Request Headers**:

```typescript
{
  Authorization: 'Bearer <admin-token>'; // TODO: Add auth
}
```

**Response**:

```typescript
interface DeleteRoomResponse {
  success: boolean;
  message: string;
}
```

**Implementation**:

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;

  // TODO: Add authorization check (verify teacher owns room)

  const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

  try {
    await roomService.deleteRoom(roomCode);

    return NextResponse.json({
      success: true,
      message: `Room ${roomCode} deleted successfully`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
```

---

### 5. Modified: GET /api/connection-details

**Changes**: Add room existence validation

**Before**:

```typescript
// Generated token for any roomName, room auto-created on join
const participantToken = await createParticipantToken(userInfo, roomName, ...);
```

**After**:

```typescript
// Validate room exists for non-random room codes
const isRandomCode = /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(roomName);

if (!isRandomCode) {
  // This is a persistent room code - validate it exists
  const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
  const rooms = await roomService.listRooms([roomName]);

  if (rooms.length === 0) {
    return NextResponse.json(
      { error: `Room "${roomName}" not found. Please check the room code.` },
      { status: 404 }
    );
  }

  // Extract metadata for enhanced token generation
  const roomMetadata: RoomMetadata = JSON.parse(rooms[0].metadata || '{}');
  // Use metadata.type to determine if classroom/speech without URL params
}

const participantToken = await createParticipantToken(userInfo, roomName, ...);
```

---

## UI/UX Components

### 1. Landing Page Updates (`app/page.tsx`)

**New Sections**:

```tsx
// Add to DemoMeetingTab
<div className="room-options">
  {/* Existing Quick Meeting */}
  <button onClick={startMeeting}>Start Meeting</button>

  {/* NEW: Persistent Room Options */}
  <div className="persistent-rooms">
    <h3>Persistent Rooms</h3>

    {/* For Teachers */}
    <button onClick={() => setShowCreateModal(true)}>Create Persistent Room</button>
    <button onClick={() => router.push('/dashboard')}>My Rooms</button>

    {/* For Students */}
    <div className="join-by-code">
      <Input
        placeholder="Enter room code (e.g., MATH101)"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
      />
      <button onClick={handleJoinByCode}>Join</button>
    </div>
  </div>
</div>;

{
  showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />;
}
```

---

### 2. CreateRoomModal Component

**Location**: `app/components/CreateRoomModal.tsx`

**Features**:

- Room code input with validation
- Display name input
- Type selector (Classroom/Speech)
- Teacher info fields
- Language selector
- Max participants slider
- PIN toggle
- Preview of shareable link

**Component**:

```tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/stateful-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface CreateRoomModalProps {
  onClose: () => void;
}

export function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    roomCode: '',
    displayName: '',
    type: 'classroom' as 'classroom' | 'speech',
    teacherName: '',
    teacherLanguage: 'en',
    maxParticipants: 50,
    pin: '',
    enablePin: false,
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{
    shareableLink: string;
    studentLink: string;
  } | null>(null);

  const handleSubmit = async () => {
    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          pin: formData.enablePin ? formData.pin : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create room');
      }

      const data = await response.json();
      setCreated({
        shareableLink: data.shareableLink,
        studentLink: data.studentLink,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    return (
      <div className="modal">
        <h2>✅ Room Created Successfully!</h2>

        <div className="room-details">
          <p>
            <strong>Room Code:</strong> {formData.roomCode}
          </p>
          <p>
            <strong>Display Name:</strong> {formData.displayName}
          </p>
        </div>

        <div className="share-links">
          <div>
            <label>Teacher Link:</label>
            <Input value={created.shareableLink} readOnly />
            <Button onClick={() => navigator.clipboard.writeText(created.shareableLink)}>
              Copy
            </Button>
          </div>

          <div>
            <label>Student Link:</label>
            <Input value={created.studentLink} readOnly />
            <Button onClick={() => navigator.clipboard.writeText(created.studentLink)}>Copy</Button>
          </div>
        </div>

        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="modal">
      <h2>Create Persistent Room</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {/* Room Code */}
        <div>
          <label>Room Code *</label>
          <Input
            placeholder="MATH101"
            value={formData.roomCode}
            onChange={(e) => setFormData({ ...formData, roomCode: e.target.value.toUpperCase() })}
            pattern="[A-Z0-9-]{4,20}"
            required
          />
          <small>4-20 characters, alphanumeric and hyphens only</small>
        </div>

        {/* Display Name */}
        <div>
          <label>Display Name *</label>
          <Input
            placeholder="Mathematics 101"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            required
          />
        </div>

        {/* Type */}
        <div>
          <label>Room Type *</label>
          <Select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as 'classroom' | 'speech' })
            }
          >
            <option value="classroom">Classroom (Teacher/Students)</option>
            <option value="speech">Speech (Speaker/Listeners)</option>
          </Select>
        </div>

        {/* Teacher Name */}
        <div>
          <label>Your Name *</label>
          <Input
            placeholder="Prof. Smith"
            value={formData.teacherName}
            onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
            required
          />
        </div>

        {/* Teacher Language */}
        <div>
          <label>Teaching Language *</label>
          <Select
            value={formData.teacherLanguage}
            onChange={(e) => setFormData({ ...formData, teacherLanguage: e.target.value })}
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            {/* Add more languages */}
          </Select>
        </div>

        {/* Max Participants */}
        <div>
          <label>Max Participants</label>
          <input
            type="range"
            min="10"
            max="200"
            value={formData.maxParticipants}
            onChange={(e) =>
              setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })
            }
          />
          <span>{formData.maxParticipants === 200 ? 'Unlimited' : formData.maxParticipants}</span>
        </div>

        {/* PIN Protection */}
        <div>
          <label>
            <input
              type="checkbox"
              checked={formData.enablePin}
              onChange={(e) => setFormData({ ...formData, enablePin: e.target.checked })}
            />
            Enable PIN Protection
          </label>

          {formData.enablePin && (
            <Input
              type="text"
              placeholder="1234"
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
              pattern="[0-9]{4,6}"
              maxLength={6}
            />
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Room'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

### 3. Room Dashboard Component

**Location**: `app/dashboard/page.tsx`

**Features**:

- Table of created rooms
- Room status (active/empty)
- Participant count
- Quick actions (Copy link, Join, Delete)
- Search and filter

**Component Structure**:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/stateful-button';

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', teacher: '' });

  useEffect(() => {
    loadRooms();
  }, [filter]);

  const loadRooms = async () => {
    const params = new URLSearchParams();
    if (filter.type) params.append('type', filter.type);
    if (filter.teacher) params.append('teacher', filter.teacher);

    const response = await fetch(`/api/rooms?${params}`);
    const data = await response.json();
    setRooms(data.rooms);
    setLoading(false);
  };

  const handleDelete = async (roomCode: string) => {
    if (!confirm(`Delete room ${roomCode}?`)) return;

    await fetch(`/api/rooms/${roomCode}`, { method: 'DELETE' });
    loadRooms();
  };

  return (
    <div className="dashboard">
      <h1>My Rooms</h1>

      {/* Filters */}
      <div className="filters">
        <select onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">All Types</option>
          <option value="classroom">Classroom</option>
          <option value="speech">Speech</option>
        </select>

        <input
          placeholder="Search by teacher..."
          onChange={(e) => setFilter({ ...filter, teacher: e.target.value })}
        />
      </div>

      {/* Room Table */}
      <table>
        <thead>
          <tr>
            <th>Room Code</th>
            <th>Display Name</th>
            <th>Type</th>
            <th>Teacher</th>
            <th>Participants</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.sid}>
              <td>
                <strong>{room.name}</strong>
              </td>
              <td>{room.metadata.displayName}</td>
              <td>{room.metadata.type}</td>
              <td>{room.metadata.teacherName}</td>
              <td>{room.numParticipants}</td>
              <td>{room.numParticipants > 0 ? '🟢 Active' : '⚪ Empty'}</td>
              <td>
                <Button onClick={() => copyLink(room.name)}>Copy Link</Button>
                <Button onClick={() => joinRoom(room.name)}>Join</Button>
                <Button onClick={() => handleDelete(room.name)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Room Metadata Schema

### TypeScript Interface

```typescript
interface RoomMetadata {
  // Core identifiers
  displayName: string; // "Mathematics 101"
  type: 'classroom' | 'speech'; // Room mode

  // Teacher/Speaker information
  teacherName: string; // "Prof. Smith"
  teacherLanguage: string; // ISO 639-1 code: "en", "ar", "es"
  teacherId?: string; // Optional unique ID (future: link to user account)

  // Access control
  pin?: string; // Optional 4-6 digit PIN
  maxParticipants: number; // 0 = unlimited

  // Timestamps
  createdAt: number; // Unix timestamp (ms)
  lastUsedAt?: number; // Last session timestamp
  updatedAt?: number; // Last metadata update

  // Optional scheduling (Phase 2)
  schedule?: {
    recurring: boolean;
    dayOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    startTime?: string; // "14:00" (24h format)
    endTime?: string; // "15:30"
    duration?: number; // Minutes
    timezone?: string; // "America/New_York"
  };

  // Optional analytics (Phase 2)
  stats?: {
    totalSessions: number;
    totalParticipants: number;
    averageParticipants: number;
    totalDuration: number; // Minutes
  };

  // Custom fields (extensible)
  [key: string]: any;
}
```

### Storage Considerations

**Size Limit**: 64 KiB (65,536 bytes)
**Typical Size**: ~500-1000 bytes per room configuration
**Capacity**: Easily stores all required fields with room for growth

**Example**:

```json
{
  "displayName": "Mathematics 101 - Calculus",
  "type": "classroom",
  "teacherName": "Prof. John Smith",
  "teacherLanguage": "en",
  "pin": "1234",
  "maxParticipants": 50,
  "createdAt": 1703001600000,
  "lastUsedAt": 1703088000000
}
```

**Size**: ~200 bytes

---

## Implementation Phases

### Phase 1: Backend Foundation (Days 1-3)

**Day 1: Room Creation API**

- [ ] Create `/api/rooms/create/route.ts`
- [ ] Implement RoomServiceClient integration
- [ ] Add room code validation
- [ ] Add uniqueness checking
- [ ] Test room creation and metadata storage
- [ ] Verify rooms persist on LiveKit server

**Day 2: Room Management APIs**

- [ ] Create `/api/rooms/route.ts` (GET - list rooms)
- [ ] Create `/api/rooms/[roomCode]/route.ts` (GET, DELETE)
- [ ] Implement filtering logic
- [ ] Add error handling for non-existent rooms
- [ ] Test listing and deletion

**Day 3: Token Generation Updates**

- [ ] Modify `/api/connection-details/route.ts`
- [ ] Add room existence validation
- [ ] Distinguish persistent vs ad-hoc rooms (regex check)
- [ ] Extract metadata for enhanced token generation
- [ ] Test token generation for both room types

**Deliverable**: Fully functional backend APIs, tested via Postman/curl

---

### Phase 2: Frontend Components (Days 4-6)

**Day 4: Room Creation UI**

- [ ] Create `CreateRoomModal.tsx` component
- [ ] Implement form with all fields
- [ ] Add real-time validation
- [ ] Show success state with shareable links
- [ ] Add copy-to-clipboard functionality
- [ ] Style according to existing design system

**Day 5: Dashboard & Listing**

- [ ] Create `/app/dashboard/page.tsx`
- [ ] Implement room listing table
- [ ] Add filter and search functionality
- [ ] Implement delete confirmation
- [ ] Add room status indicators (active/empty)
- [ ] Test with multiple rooms

**Day 6: Join Flow Updates**

- [ ] Update landing page (`app/page.tsx`)
- [ ] Add "Join by Code" input field
- [ ] Implement room code validation
- [ ] Show error for non-existent rooms
- [ ] Update PreJoin to show room metadata
- [ ] Test end-to-end join flow

**Deliverable**: Complete UI for creating, listing, and joining persistent rooms

---

### Phase 3: Integration & Testing (Days 7-8)

**Day 7: End-to-End Testing**

- [ ] Test complete teacher flow (create → share → join)
- [ ] Test complete student flow (code → join → session)
- [ ] Test room persistence (create → leave → rejoin)
- [ ] Test multiple simultaneous sessions in same room
- [ ] Test edge cases (invalid codes, deleted rooms, etc.)
- [ ] Test backward compatibility (ad-hoc rooms still work)

**Day 8: Polish & Documentation**

- [ ] Fix bugs discovered in testing
- [ ] Add loading states and error messages
- [ ] Improve UX (animations, feedback, etc.)
- [ ] Update user documentation
- [ ] Create teacher/student guides
- [ ] Prepare deployment

**Deliverable**: Production-ready persistent rooms feature

---

## Edge Cases & Solutions

### 1. Room Code Conflicts

**Problem**: Teacher wants "MATH101" but another room exists with that code

**Solution**:

```typescript
// In CreateRoomModal, suggest alternatives on conflict
const suggestAlternatives = (baseCode: string) => {
  const year = new Date().getFullYear();
  return [
    `${baseCode}-${year}`,
    `${baseCode}-FALL`,
    `${baseCode}-2`,
    `${baseCode}-SPRING`,
  ];
};

// Show suggestions in error message
if (error.includes('already exists')) {
  return (
    <div className="error">
      Room code "{roomCode}" is already taken.
      Try: {suggestAlternatives(roomCode).join(', ')}
    </div>
  );
}
```

---

### 2. Empty Timeout Management

**Problem**: Rooms auto-delete after `emptyTimeout` expires

**Solution**:

```typescript
// Set long timeout for persistent rooms (7 days)
emptyTimeout: 604800; // 7 days in seconds

// Add "Refresh Room" button in dashboard
const refreshRoom = async (roomCode: string) => {
  // Extend timeout by re-creating room with same config
  const room = await roomService.listRooms([roomCode]);
  await roomService.updateRoomMetadata(roomCode, {
    ...room.metadata,
    lastRefreshedAt: Date.now(),
  });
};

// Auto-refresh on teacher join (optional)
useEffect(() => {
  if (isTeacher && room) {
    refreshRoom(room.name);
  }
}, [isTeacher, room]);
```

**Alternative**: Set `emptyTimeout: 0` for "never delete" (requires manual cleanup)

---

### 3. Room Deletion While Active

**Problem**: Admin deletes room with participants currently in session

**Solution**:

```typescript
// Show confirmation with participant count
const handleDelete = async (roomCode: string) => {
  const room = await fetch(`/api/rooms/${roomCode}`).then((r) => r.json());

  if (room.room.numParticipants > 0) {
    const confirmed = confirm(
      `⚠️ ${room.room.numParticipants} participants are currently in this room. ` +
        `Deleting will disconnect them. Continue?`,
    );

    if (!confirmed) return;
  }

  await fetch(`/api/rooms/${roomCode}`, { method: 'DELETE' });

  // Show notification
  toast.success(`Room ${roomCode} deleted. Participants have been disconnected.`);
};

// Alternative: Implement "Archive" instead of delete
// Archived rooms can't be joined but data is preserved
```

---

### 4. Token Generation for Non-Existent Room

**Problem**: User has old link to deleted room, requests token

**Solution**:

```typescript
// In /api/connection-details
const rooms = await roomService.listRooms([roomName]);

if (rooms.length === 0) {
  return NextResponse.json(
    {
      error: "Room Not Found",
      message: `The room "${roomName}" no longer exists. It may have been deleted.`,
      suggestion: "Please contact the room creator for an updated link.",
    },
    { status: 404 }
  );
}

// In PageClientImpl, show user-friendly error
if (connectionError?.status === 404) {
  return (
    <div className="room-not-found">
      <h2>Room Not Found</h2>
      <p>{connectionError.message}</p>
      <p>{connectionError.suggestion}</p>
      <Button onClick={() => router.push('/')}>Back to Home</Button>
    </div>
  );
}
```

---

### 5. Multiple Teachers in Same Room

**Problem**: Two people try to join as teacher role

**Solution**:

```typescript
// Strategy 1: First teacher is primary admin, others are co-teachers
const teacherRole = determineTeacherRole(participants);

if (teacherRole === 'primary') {
  // Full admin rights
  grant = { roomAdmin: true, canPublish: true, ... };
} else {
  // Co-teacher: can publish but not admin actions
  grant = { roomAdmin: false, canPublish: true, ... };
}

// Strategy 2: Only room creator can be teacher (Phase 2 with auth)
if (userId !== room.metadata.teacherId) {
  return NextResponse.json(
    { error: "Only the room creator can join as teacher" },
    { status: 403 }
  );
}

// Strategy 3: Allow multiple teachers, show badges
// Display "Primary Teacher" vs "Co-Teacher" in UI
```

---

### 6. Case Sensitivity in Room Codes

**Problem**: User enters "math101" but room is "MATH101"

**Solution**:

```typescript
// Store room codes in uppercase internally
const normalizedCode = roomCode.toUpperCase();

// Case-insensitive matching
const existingRoom = allRooms.find((r) => r.name.toUpperCase() === normalizedCode);

// Display in original case but match case-insensitively
// User sees: "MATH101"
// Can join with: "math101", "Math101", "MATH101"
```

---

### 7. Room Code Validation

**Problem**: Users enter invalid characters or too short/long codes

**Solution**:

```typescript
const ROOM_CODE_REGEX = /^[A-Z0-9-]{4,20}$/;

const validateRoomCode = (code: string): { valid: boolean; error?: string } => {
  if (code.length < 4) {
    return { valid: false, error: 'Room code must be at least 4 characters' };
  }

  if (code.length > 20) {
    return { valid: false, error: 'Room code must be 20 characters or less' };
  }

  if (!ROOM_CODE_REGEX.test(code)) {
    return {
      valid: false,
      error: 'Room code can only contain letters, numbers, and hyphens',
    };
  }

  return { valid: true };
};

// Show real-time validation in form
const [codeError, setCodeError] = useState('');

const handleCodeChange = (value: string) => {
  const validation = validateRoomCode(value);
  setCodeError(validation.error || '');
  setFormData({ ...formData, roomCode: value });
};
```

---

## Future Enhancements (Phase 2)

### 1. User Authentication & Authorization

**Goal**: Link rooms to teacher accounts, implement proper access control

**Features**:

- Teacher accounts with login
- Room ownership tracking
- Permission management (who can delete/edit)
- Student rosters

**Tech Stack Options**:

- Next-Auth + PostgreSQL
- Supabase Auth
- Clerk
- Auth0

**Database Schema**:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  role VARCHAR(20) -- 'teacher', 'student', 'admin'
);

CREATE TABLE rooms (
  room_code VARCHAR(20) PRIMARY KEY,
  display_name VARCHAR(255),
  owner_id UUID REFERENCES users(id),
  type VARCHAR(20),
  created_at TIMESTAMP,
  -- LiveKit metadata reference
);

CREATE TABLE room_access (
  id UUID PRIMARY KEY,
  room_code VARCHAR(20) REFERENCES rooms(room_code),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20), -- 'owner', 'co-teacher', 'student'
  granted_at TIMESTAMP
);
```

---

### 2. Room Scheduling & Calendar Integration

**Goal**: Allow teachers to schedule recurring sessions with calendar sync

**Features**:

- Set recurring schedule (weekly, daily)
- Time zone support
- Email/SMS reminders
- Google Calendar / Outlook integration
- iCal export

**Implementation**:

```typescript
interface RoomSchedule {
  recurring: boolean;
  pattern: 'daily' | 'weekly' | 'monthly';
  daysOfWeek: number[]; // [1,3,5] for Mon/Wed/Fri
  startTime: string; // "14:00"
  endTime: string; // "15:30"
  timezone: string; // "America/New_York"
  startDate: string; // "2024-01-15"
  endDate?: string; // "2024-05-15" (semester end)
}

// Generate calendar events
const generateEvents = (schedule: RoomSchedule) => {
  const events = [];
  let currentDate = new Date(schedule.startDate);
  const endDate = new Date(schedule.endDate || Date.now() + 90 * 24 * 60 * 60 * 1000);

  while (currentDate <= endDate) {
    if (schedule.daysOfWeek.includes(currentDate.getDay())) {
      events.push({
        date: currentDate.toISOString().split('T')[0],
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        title: `${roomMetadata.displayName}`,
        location: `https://app.com/rooms/${roomCode}`,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return events;
};
```

**Calendar Integration**:

```typescript
// Google Calendar API
const addToGoogleCalendar = async (event, roomCode) => {
  const calendarEvent = {
    summary: event.title,
    location: event.location,
    start: {
      dateTime: `${event.date}T${event.startTime}:00`,
      timeZone: schedule.timezone,
    },
    end: {
      dateTime: `${event.date}T${event.endTime}:00`,
      timeZone: schedule.timezone,
    },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${getDays(schedule.daysOfWeek)}`],
  };

  // POST to Google Calendar API
};
```

---

### 3. Analytics & Session History

**Goal**: Track room usage, participant engagement, attendance

**Features**:

- Session history (date, duration, participants)
- Attendance tracking
- Engagement metrics (talk time, participation)
- Export reports (CSV, PDF)
- Charts and visualizations

**Database Schema**:

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  room_code VARCHAR(20) REFERENCES rooms(room_code),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_minutes INTEGER,
  peak_participants INTEGER,
  total_participants INTEGER
);

CREATE TABLE session_participants (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  participant_identity VARCHAR(255),
  participant_name VARCHAR(255),
  joined_at TIMESTAMP,
  left_at TIMESTAMP,
  duration_minutes INTEGER,
  role VARCHAR(20)
);
```

**Analytics Dashboard**:

```tsx
// /app/dashboard/analytics/[roomCode]/page.tsx
export default function RoomAnalytics({ roomCode }) {
  const stats = useMemo(
    () => ({
      totalSessions: sessions.length,
      totalParticipants: sessions.reduce((sum, s) => sum + s.total_participants, 0),
      avgParticipants: totalParticipants / totalSessions,
      totalDuration: sessions.reduce((sum, s) => sum + s.duration_minutes, 0),
      avgDuration: totalDuration / totalSessions,
    }),
    [sessions],
  );

  return (
    <div>
      <h1>Analytics: {roomCode}</h1>

      <div className="stats-grid">
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard label="Total Participants" value={stats.totalParticipants} />
        <StatCard label="Avg Participants" value={stats.avgParticipants.toFixed(1)} />
        <StatCard label="Total Duration" value={`${stats.totalDuration} min`} />
      </div>

      <Chart data={sessionsOverTime} />

      <AttendanceTable participants={participantHistory} />
    </div>
  );
}
```

---

### 4. Advanced Room Features

**Waiting Room**:

- Students wait for teacher approval before joining
- Teacher sees list of waiting participants
- One-click admit or reject

**Room Templates**:

- Save common configurations as templates
- Quick create from template
- Share templates with other teachers

**Breakout Rooms**:

- Split students into smaller groups
- Random or manual assignment
- Timer and auto-return to main room

**Recording Management**:

- Automatic recording for all sessions
- Cloud storage integration (S3, Google Drive)
- Playback portal for students
- Download and sharing controls

---

## Code Examples

### Complete Room Creation Flow

```typescript
// 1. Teacher clicks "Create Room" in UI
// 2. Form submission
const handleCreateRoom = async (formData: CreateRoomFormData) => {
  const response = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'MATH101',
      displayName: 'Mathematics 101',
      type: 'classroom',
      teacherName: 'Prof. Smith',
      teacherLanguage: 'en',
      maxParticipants: 50,
      emptyTimeout: 604800, // 7 days
    }),
  });

  const { room, shareableLink, studentLink } = await response.json();

  // 3. Show success modal with links
  showSuccessModal({
    roomCode: room.name,
    teacherLink: shareableLink,
    studentLink: studentLink,
  });
};

// 4. Server creates room
// In /api/rooms/create/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate and create room
  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  const metadata: RoomMetadata = {
    displayName: body.displayName,
    type: body.type,
    teacherName: body.teacherName,
    teacherLanguage: body.teacherLanguage,
    maxParticipants: body.maxParticipants,
    createdAt: Date.now(),
  };

  const room = await roomService.createRoom({
    name: body.roomCode,
    emptyTimeout: body.emptyTimeout || 604800,
    maxParticipants: body.maxParticipants || 0,
    metadata: JSON.stringify(metadata),
  });

  return NextResponse.json({
    success: true,
    room: {
      name: room.name,
      sid: room.sid,
      metadata,
    },
    shareableLink: `${process.env.NEXT_PUBLIC_BASE_URL}/rooms/${body.roomCode}?classroom=true&role=teacher`,
    studentLink: `${process.env.NEXT_PUBLIC_BASE_URL}/s/${body.roomCode}`,
  });
}
```

---

### Student Join Flow

```typescript
// 1. Student enters room code
const handleJoinByCode = async (roomCode: string) => {
  // 2. Validate room exists
  const response = await fetch(`/api/rooms/${roomCode}`);

  if (!response.ok) {
    setError(`Room "${roomCode}" not found. Please check the code.`);
    return;
  }

  const { room } = await response.json();
  const metadata: RoomMetadata = room.metadata;

  // 3. Navigate to PreJoin with room context
  router.push(`/rooms/${roomCode}?${metadata.type}=true&role=student`);
};

// 4. PreJoin component shows room details
function CustomPreJoin() {
  const roomMetadata = useRoomMetadata(); // Fetched from API

  return (
    <div>
      <h1>Joining: {roomMetadata.displayName}</h1>
      <p>Teacher: {roomMetadata.teacherName}</p>
      <p>Language: {roomMetadata.teacherLanguage}</p>

      {roomMetadata.pin && (
        <Input
          type="password"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
      )}

      <Button onClick={handleSubmit}>Join Class</Button>
    </div>
  );
}

// 5. Token generation validates room
// In /api/connection-details
const roomService = new RoomServiceClient(...);
const rooms = await roomService.listRooms([roomName]);

if (rooms.length === 0) {
  return NextResponse.json({ error: "Room not found" }, { status: 404 });
}

// Verify PIN if required
const metadata: RoomMetadata = JSON.parse(rooms[0].metadata);
if (metadata.pin && metadata.pin !== requestedPin) {
  return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
}

// Generate token for validated room
const token = await createParticipantToken(...);
```

---

### Room Listing with Filters

```typescript
// Component
function RoomDashboard() {
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({ type: '', teacher: '' });

  useEffect(() => {
    const fetchRooms = async () => {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.teacher) params.append('teacher', filters.teacher);

      const response = await fetch(`/api/rooms?${params}`);
      const data = await response.json();
      setRooms(data.rooms);
    };

    fetchRooms();
  }, [filters]);

  return (
    <div>
      {/* Filters */}
      <select onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
        <option value="">All Types</option>
        <option value="classroom">Classroom</option>
        <option value="speech">Speech</option>
      </select>

      {/* Room Grid */}
      <div className="room-grid">
        {rooms.map(room => (
          <RoomCard
            key={room.sid}
            roomCode={room.name}
            displayName={room.metadata.displayName}
            teacher={room.metadata.teacherName}
            participants={room.numParticipants}
            status={room.numParticipants > 0 ? 'active' : 'empty'}
          />
        ))}
      </div>
    </div>
  );
}

// Server-side filtering
export async function GET(request: NextRequest) {
  const typeFilter = request.nextUrl.searchParams.get('type');
  const teacherFilter = request.nextUrl.searchParams.get('teacher');

  const roomService = new RoomServiceClient(...);
  const allRooms = await roomService.listRooms();

  const filteredRooms = allRooms.filter(room => {
    if (!room.metadata) return false;

    const metadata: RoomMetadata = JSON.parse(room.metadata);

    // Type filter
    if (typeFilter && metadata.type !== typeFilter) return false;

    // Teacher name filter (case-insensitive substring match)
    if (teacherFilter) {
      const searchTerm = teacherFilter.toLowerCase();
      const teacherName = metadata.teacherName.toLowerCase();
      if (!teacherName.includes(searchTerm)) return false;
    }

    return true;
  });

  return NextResponse.json({
    rooms: filteredRooms,
    total: filteredRooms.length,
  });
}
```

---

## Migration Path to Supabase (Future)

### When to Migrate

**Triggers**:

- Room listing becomes slow (>2 seconds)
- Need complex queries (search, sort by multiple fields)
- Implementing user accounts
- Adding session history/analytics
- 100+ rooms in system

### Migration Strategy

**Phase 1: Add Database, Keep Metadata** (Hybrid Approach)

```typescript
// Supabase schema (minimal)
table rooms {
  room_code: text primary key,
  display_name: text,
  teacher_name: text,
  type: text,
  created_at: timestamp,
  livekit_sid: text,
  // LiveKit metadata is source of truth for config
}

// On room creation, write to both
const room = await roomService.createRoom({
  name: roomCode,
  metadata: JSON.stringify(fullMetadata),
});

// Also write to Supabase
await supabase.from('rooms').insert({
  room_code: roomCode,
  display_name: fullMetadata.displayName,
  teacher_name: fullMetadata.teacherName,
  type: fullMetadata.type,
  livekit_sid: room.sid,
});

// List rooms from Supabase (faster queries)
const { data } = await supabase
  .from('rooms')
  .select('*')
  .eq('type', 'classroom')
  .order('created_at', { ascending: false });

// Get full config from LiveKit metadata when needed
const room = await roomService.listRooms([roomCode]);
const fullConfig = JSON.parse(room[0].metadata);
```

**Phase 2: Sync Existing Rooms**

```typescript
// One-time migration script
async function syncRoomsToDatabase() {
  const roomService = new RoomServiceClient(...);
  const allRooms = await roomService.listRooms();

  const roomData = allRooms.map(room => {
    const metadata: RoomMetadata = JSON.parse(room.metadata || '{}');
    return {
      room_code: room.name,
      display_name: metadata.displayName,
      teacher_name: metadata.teacherName,
      type: metadata.type,
      created_at: new Date(metadata.createdAt),
      livekit_sid: room.sid,
    };
  });

  await supabase.from('rooms').insert(roomData);
  console.log(`Synced ${roomData.length} rooms to database`);
}
```

**Phase 3: Gradual Feature Migration**

- Keep metadata for runtime config (type, language, pin)
- Move historical data to database (sessions, analytics)
- Keep both systems in sync via API middleware
- Gradually move read operations to database

---

## Testing Checklist

### Unit Tests

- [ ] Room code validation (valid/invalid formats)
- [ ] Metadata serialization/deserialization
- [ ] Token generation with room metadata
- [ ] Filter logic (type, teacher name)

### Integration Tests

- [ ] Room creation via API
- [ ] Room listing with filters
- [ ] Room deletion
- [ ] Token generation for existing room
- [ ] Token rejection for non-existent room

### End-to-End Tests

- [ ] Complete teacher flow (create → share → join)
- [ ] Complete student flow (code → join → session)
- [ ] Multiple participants in same persistent room
- [ ] Room persistence across sessions
- [ ] Backward compatibility (ad-hoc rooms)
- [ ] Error handling (invalid codes, deleted rooms)

### Edge Cases

- [ ] Room code already exists
- [ ] Room deleted while participants active
- [ ] Token request for deleted room
- [ ] Case-insensitive room code matching
- [ ] Special characters in room name
- [ ] Very long display names
- [ ] Empty timeout expiration
- [ ] Maximum participants limit

---

## Deployment Checklist

### Environment Variables

```bash
# .env.production
LIVEKIT_API_KEY=your_production_key
LIVEKIT_API_SECRET=your_production_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Pre-Deployment

- [ ] Test on staging environment
- [ ] Verify room creation works
- [ ] Verify token generation works
- [ ] Test with real users
- [ ] Performance testing (100+ rooms)
- [ ] Load testing (simultaneous sessions)

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check room creation success rate
- [ ] Monitor LiveKit API usage
- [ ] Collect user feedback
- [ ] Track adoption metrics

---

## Success Metrics

### Adoption Metrics

- Number of persistent rooms created
- Percentage of sessions using persistent vs ad-hoc rooms
- Average reuse count per room
- Teacher satisfaction score

### Performance Metrics

- Room creation time (<1 second)
- Room listing time (<2 seconds)
- Token generation time (<500ms)
- API error rate (<0.1%)

### Business Metrics

- User retention improvement
- Session frequency increase
- Feature adoption rate
- User satisfaction scores

---

## Conclusion

This implementation plan provides a complete roadmap for adding Zoom-like persistent rooms to your LiveKit application. The metadata-first approach minimizes infrastructure complexity while delivering all core functionality. The system is designed for gradual enhancement, allowing you to add features like user authentication and analytics as your needs grow.

**Key Takeaways**:

1. ✅ Fully possible with LiveKit's native APIs
2. ✅ No database required for MVP
3. ✅ 5-8 days to production-ready feature
4. ✅ Scalable architecture with clear migration path
5. ✅ Backward compatible with existing ad-hoc rooms

**Next Steps**: Begin Phase 1 implementation with backend APIs!
