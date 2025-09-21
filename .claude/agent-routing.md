# Agent Routing Guide for LiveKit Projects

**Critical Directive**: LiveKit's real-time, event-driven architecture requires specialized expertise. Incorrect patterns from generalist personas have caused system breakages. This document establishes clear routing rules.

## Primary Routing Rule

**LiveKit operations MUST route to LiveKit Architect persona. No exceptions.**

### Documentation Verification Requirement

**The LiveKit Architect MUST verify all implementations against current documentation:**

1. **Before ANY code is written**: Check LiveKit version and fetch current docs via Context7
2. **Never implement from memory**: All API calls must be verified against current documentation
3. **Version awareness**: Always know which LiveKit version is in use and check for breaking changes
4. **Pattern validation**: Verify patterns against official examples, not assumptions

## Decision Hierarchy

```
Is it LiveKit-related?
├─ YES → LiveKit Architect (Primary)
│   └─ May consult other personas for specific aspects
└─ NO → Check domain
    ├─ Frontend UI (non-video) → Frontend Persona
    ├─ Backend API (non-token) → Backend Persona
    ├─ Database/Business Logic → Backend Persona
    ├─ Authentication (non-token) → Security Persona
    └─ General/Unknown → Architect Persona
```

## LiveKit Architect Territory

### Exclusive Domain (LiveKit Architect ONLY)

These areas require LiveKit's state machine and event-driven mental model:

#### File Paths

```
ALWAYS LiveKit Architect:
/app/rooms/*                       # All room-related pages
/app/api/connection-details/*      # Token generation
/app/api/token/*                   # Token endpoints
/app/api/recordings/*              # Recording management
/app/custom/*                      # Custom connection flows
/lib/livekit/*                     # LiveKit utilities
/components/*VideoConference*      # Video conference components
/components/*Room*                 # Room components
/components/*Track*                # Track components
/components/*Participant*         # Participant components
/components/*PreJoin*              # PreJoin components
/components/*MediaDevice*          # Media device selectors
```

#### Operations

```
ALWAYS LiveKit Architect:
- Token generation and validation
- Room connection/disconnection
- Track acquisition/publishing/subscription
- Participant state management
- Media device handling
- WebRTC statistics and quality
- Recording configuration
- Data channel messaging
- Screen sharing implementation
- Simulcast/codec configuration
- TURN server configuration
- Connection recovery strategies
```

#### Concepts

```
ALWAYS LiveKit Architect:
- State machines (room/track/participant states)
- Event-driven patterns
- Eventual consistency
- Dual-plane architecture (signaling/media)
- WebRTC concepts
- Real-time communication patterns
- Network resilience
- Quality adaptation
```

### Collaborative Zones

Areas where LiveKit Architect leads but consults others:

#### Token Generation Security

```
Primary: LiveKit Architect (token structure, permissions)
Consults: Security Persona (authentication flow, secret management)

Example:
// LiveKit Architect handles token creation
// Security Persona reviews auth verification
```

#### UI Components with Video

```
Primary: LiveKit Architect (video element management, track attachment)
Consults: Frontend Persona (styling, layout, non-video interactions)

Example:
// LiveKit Architect handles track lifecycle
// Frontend Persona handles CSS/animations
```

#### Recording Storage

```
Primary: LiveKit Architect (recording initiation, LiveKit egress)
Consults: Backend Persona (S3 storage, database persistence)

Example:
// LiveKit Architect configures recording
// Backend Persona handles file storage
```

## Generalist Persona Territory

### Frontend Persona Domain

Handles ONLY when no LiveKit involvement:

```
ALLOWED for Frontend:
/app/page.tsx                    # Landing page (no video)
/app/layout.tsx                  # Layout (no video)
/components/ui/*                 # Pure UI components
/styles/*                        # CSS/styling
/public/*                        # Static assets

NOT ALLOWED for Frontend:
- Anything with Room, Track, Participant
- Video/audio elements connected to LiveKit
- WebRTC-related UI
```

### Backend Persona Domain

Handles ONLY non-LiveKit backend logic:

```
ALLOWED for Backend:
/app/api/auth/*                  # Auth endpoints (except token)
/app/api/users/*                 # User management
/app/api/analytics/*             # Analytics endpoints
/lib/db/*                        # Database utilities
/lib/email/*                     # Email services

NOT ALLOWED for Backend:
- Token generation endpoints
- Recording endpoints
- Anything touching LiveKit SDK
```

### Security Persona Domain

Handles ONLY non-LiveKit security:

```
ALLOWED for Security:
- User authentication flow
- Session management
- API key rotation (not LiveKit keys)
- General security audits

NOT ALLOWED for Security:
- LiveKit token generation
- WebRTC security
- TURN server credentials
```

## Routing Decision Examples

### Example 1: "Add a mute button to the video conference"

**Analysis**: Involves track state management
**Route to**: LiveKit Architect
**Reason**: Muting involves LiveKit track API and state machines

### Example 2: "Style the homepage"

**Analysis**: No LiveKit involvement
**Route to**: Frontend Persona
**Reason**: Pure UI work without video components

### Example 3: "Generate a token for room access"

**Analysis**: Core LiveKit operation
**Route to**: LiveKit Architect
**Reason**: Token generation is LiveKit domain, not general auth

### Example 4: "Add user profile management"

**Analysis**: Business logic without LiveKit
**Route to**: Backend Persona
**Reason**: No real-time communication involved

### Example 5: "Debug why video isn't showing"

**Analysis**: LiveKit track subscription issue
**Route to**: LiveKit Architect
**Reason**: Requires understanding of LiveKit event flow

### Example 6: "Implement teacher/student roles"

**Analysis**: Involves LiveKit permissions
**Route to**: LiveKit Architect (Primary) + Security (Consult)
**Reason**: Token permissions are LiveKit domain

### Example 7: "Add CSS animations to video tiles"

**Analysis**: Styling of LiveKit-connected elements
**Route to**: LiveKit Architect (Primary) + Frontend (Consult)
**Reason**: Must not interfere with track attachment

## Anti-Pattern Detection

### Red Flags Requiring LiveKit Architect

If you see these patterns from generalist personas, STOP and route to LiveKit Architect:

```typescript
// ❌ WRONG: Frontend Persona attempting LiveKit
useEffect(() => {
  room.connect(url, token) // Frontend doesn't understand state machines
}, [])

// ❌ WRONG: Backend Persona handling tokens
function generateToken() {
  return jwt.sign(...) // Backend doesn't understand LiveKit permissions
}

// ❌ WRONG: Security Persona modifying WebRTC
rtcConfig.iceServers = [...] // Security doesn't understand TURN/STUN
```

### Correct Patterns

```typescript
// ✅ CORRECT: LiveKit Architect handling connection
useEffect(() => {
  let mounted = true;
  async function connect() {
    try {
      await room.connect(url, token);
      if (!mounted) {
        room.disconnect(); // Cleanup if unmounted during connection
      }
    } catch (error) {
      handleConnectionError(error); // Proper error handling
    }
  }
  connect();
  return () => {
    mounted = false;
    room.disconnect(); // Cleanup on unmount
  };
}, []);
```

## Enforcement Rules

### Mandatory Routing

These patterns MUST trigger LiveKit Architect:

1. **Import Detection**

   ```typescript
   import { Room } from 'livekit-client'; // → LiveKit Architect
   import { VideoConference } from '@livekit/components-react'; // → LiveKit Architect
   ```

2. **Keyword Detection**
   - "track", "participant", "room" (in LiveKit context)
   - "WebRTC", "simulcast", "codec"
   - "publish", "subscribe" (media context)
   - "connection quality", "bandwidth"

3. **File Path Detection**
   - Any file under `/app/rooms/`
   - Any file with "livekit" in the path
   - Any component with "Video", "Room", "Track" in the name

### Override Situations

Only these situations allow override:

1. **Pure CSS Changes**: If ONLY changing styles without touching functionality
2. **Documentation**: Writing docs about LiveKit (Scribe Persona allowed)
3. **Testing**: Writing tests for LiveKit components (QA Persona consults LiveKit Architect)

## Quality Gates

Before any LiveKit-related code is written:

1. **Verify Routing**: Is LiveKit Architect the primary persona?
2. **Check Foundation**: Does the approach align with `00-foundation.md`?
3. **Pattern Compliance**: Does it follow patterns from `01-patterns.md`?
4. **Integration Safety**: Are boundaries from `02-integration-points.md` respected?

## Summary

**The Golden Rule**: If it touches LiveKit, WebRTC, real-time communication, or any video/audio functionality in this repository, it MUST be handled by the LiveKit Architect persona.

Generalist personas are valuable for their domains but must not attempt LiveKit operations. The cost of incorrect patterns in real-time systems is immediate user-facing breakage.

**When in doubt, route to LiveKit Architect.**
