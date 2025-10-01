# Routing Architecture Documentation

## Overview

This application implements a **dual-purpose routing system** that supports two distinct modes for video conferencing:

1. **Classroom Mode** - Traditional educational setup with teacher/student roles
2. **Speech Mode** - Translation-focused setup with speaker/listener roles

Both modes share core infrastructure but have independent UI components and behaviors, allowing them to be modified separately without affecting each other.

## URL Routing Patterns

### Classroom Mode Routes

| Route            | Redirects To                                            | Description               |
| ---------------- | ------------------------------------------------------- | ------------------------- |
| `/s/[roomName]`  | `/rooms/[roomName]?classroom=true&role=student`         | Student join link         |
| `/t/[roomName]`  | `/rooms/[roomName]?classroom=true&role=teacher`         | Teacher join link         |
| `/sp/[roomName]` | `/rooms/[roomName]?classroom=true&role=student_speaker` | Student speaker join link |
| `/l/[roomName]`  | `/rooms/[roomName]?classroom=true&role=listener`        | Listener join link        |

### Speech Mode Routes

| Route                   | Redirects To                                 | Description                          |
| ----------------------- | -------------------------------------------- | ------------------------------------ |
| `/speech-s/[roomName]`  | `/rooms/[roomName]?speech=true&role=student` | Listener join link                   |
| `/speech-t/[roomName]`  | `/rooms/[roomName]?speech=true&role=teacher` | Speaker join link                    |
| `/speech-sp/[roomName]` | Not implemented                              | Would be for speech student speakers |
| `/speech-l/[roomName]`  | Not implemented                              | Would be for speech listeners        |

### Direct Access

- Regular room: `/rooms/[roomName]` (no special parameters)
- With parameters: `/rooms/[roomName]?classroom=true&role=teacher` or `?speech=true&role=student`

## Component Architecture

### Main Router Component

**`/app/rooms/[roomName]/PageClientImpl.tsx`**

This component detects the mode from URL parameters and routes to the appropriate implementation:

```typescript
// Detection logic
const isClassroom = currentUrl.searchParams.get('classroom') === 'true';
const isSpeech = currentUrl.searchParams.get('speech') === 'true';

// Routing decision
if (classroomInfo?.mode === 'classroom') {
  return <ClassroomClientImpl ... />
} else if (classroomInfo?.mode === 'speech') {
  return <SpeechClientImpl ... />
} else {
  return <CustomVideoConference ... /> // Regular mode
}
```

### Mode-Specific Implementations

#### Classroom Mode

- **Component**: `/app/rooms/[roomName]/ClassroomClientImplWithRequests.tsx`
- **Translation**: `/app/components/TranslationPanel.tsx`
- **Styles**: `/app/components/TranslationPanel.module.css`
- **Features**:
  - Student request system (raise hand)
  - Permission management UI
  - Teacher controls dropdown
  - Standard video grid layout
  - Translation sidebar (up to 50% width)

#### Speech Mode

- **Component**: `/app/rooms/[roomName]/SpeechClientImplWithRequests.tsx`
- **Translation**: `/app/components/SpeechTranslationPanel.tsx`
- **Styles**: `/app/components/SpeechTranslationPanel.module.css`
- **Features**:
  - Simplified UI (no raise hand)
  - Translation-focused layout
  - Translation panel up to 70% width (desktop)
  - Translation panel 70% height (mobile)
  - No camera/mic permission requests for listeners

## Key Differences Between Modes

### Terminology

| Classroom Mode  | Speech Mode | Description                       |
| --------------- | ----------- | --------------------------------- |
| Teacher         | Speaker     | Person presenting/speaking        |
| Student         | Listener    | Person listening/watching         |
| Student Speaker | -           | Student with speaking permissions |

### UI Differences

#### Classroom Mode

- Shows role badges (teacher icon) on participant tiles
- Has student request system with floating button
- Permission dropdown for teachers
- Translation limited to 50% screen width
- Full PreJoin with camera/mic controls

#### Speech Mode

- No role badges on participant tiles
- No request system
- Simplified controls
- Translation can expand to 70% screen width
- Simplified PreJoin for listeners (no media controls)

### PreJoin Behavior

#### Classroom Students

- Shows camera/mic controls (disabled by default)
- May request permissions if user enables them
- Shows "Speech Student Lobby" title

#### Speech Listeners

- **No camera/mic controls shown**
- **Never requests media permissions**
- **Skips all media device initialization**
- Shows "Listener Lobby" title
- Only shows name input and join button

Implementation in `CustomPreJoin.tsx`:

```typescript
// Force disable media for speech listeners
const [videoEnabled] = React.useState(isSpeechListener ? false : ...);
const [audioEnabled] = React.useState(isSpeechListener ? false : ...);

// Skip all media device setup for speech listeners
React.useEffect(() => {
  if (isSpeechListener) return;
  // ... media initialization
}, [isSpeechListener]);
```

## Shared Components

These components are used by both modes:

- `CustomPreJoin.tsx` - PreJoin screen (with mode-specific behavior)
- `CustomParticipantTile.tsx` - Video tiles (with optional role badges)
- `CustomVideoConference.tsx` - Main conference component
- `CustomControlBar.tsx` - Media controls

## Token Generation

Both modes use the same token generation logic in `/app/api/connection-details/route.ts`:

```typescript
if (isClassroom || isSpeech) {
  if (role === 'teacher') {
    // Full permissions + admin rights
    grant = {
      canPublish: true,
      roomAdmin: true,
      roomRecord: true,
      ...
    };
  } else {
    // Limited permissions for students/listeners
    grant = {
      canPublish: false, // Cannot publish initially
      canPublishData: true, // Can use chat
      ...
    };
  }
}
```

## File Structure

```
/app/
├── rooms/[roomName]/
│   ├── PageClientImpl.tsx                  # Main router
│   ├── ClassroomClientImplWithRequests.tsx # Classroom implementation
│   ├── SpeechClientImplWithRequests.tsx    # Speech implementation
│   └── *.module.css                        # Mode-specific styles
├── components/
│   ├── TranslationPanel.tsx                # Classroom translation
│   ├── TranslationPanel.module.css
│   ├── SpeechTranslationPanel.tsx          # Speech translation
│   ├── SpeechTranslationPanel.module.css
│   └── custom-prejoin/
│       └── CustomPreJoin.tsx               # Shared with mode detection
├── s/[roomName]/route.ts                   # Classroom student redirect
├── t/[roomName]/route.ts                   # Classroom teacher redirect
├── speech-s/[roomName]/route.ts            # Speech listener redirect
└── speech-t/[roomName]/route.ts            # Speech speaker redirect
```

## CSS Customizations

### Speech Mode Specific

- Translation panel max-width: `70%` (vs 50% in classroom)
- Mobile translation height: `70vh` (vs 50vh in classroom)
- Simplified participant tiles (no role badges)

### Classroom Mode Specific

- Request indicator styles
- Permission dropdown portal styles
- Role badge display on tiles

## Adding New Features

### To add a feature to Classroom mode only:

1. Edit `ClassroomClientImplWithRequests.tsx`
2. Use `TranslationPanel.tsx` for translation-related changes
3. Modify `Classroom.module.css` for styling

### To add a feature to Speech mode only:

1. Edit `SpeechClientImplWithRequests.tsx`
2. Use `SpeechTranslationPanel.tsx` for translation-related changes
3. Modify `SpeechClient.module.css` for styling

### To add a feature to both modes:

1. Edit shared components in `/app/components/`
2. Use mode detection if behavior should differ:
   ```typescript
   const isSpeechMode = classroomInfo?.mode === 'speech';
   ```

## Testing

### Classroom Mode

- Teacher: Navigate to `/t/test-room`
- Student: Navigate to `/s/test-room`

### Speech Mode

- Speaker: Navigate to `/speech-t/test-room`
- Listener: Navigate to `/speech-s/test-room`

### Direct Testing

- Classroom: `/rooms/test-room?classroom=true&role=teacher`
- Speech: `/rooms/test-room?speech=true&role=teacher`

## Important Notes

1. **Mode Isolation**: Changes to one mode don't affect the other
2. **Permission Handling**: Speech listeners never trigger browser permission requests
3. **Translation Focus**: Speech mode prioritizes translation UI (70% screen real estate)
4. **Simplified UX**: Speech mode removes unnecessary features for cleaner experience
5. **Shared Infrastructure**: Both modes use same LiveKit integration and token generation
