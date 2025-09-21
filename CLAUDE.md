# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development

```bash
pnpm dev         # Start development server on http://localhost:3000
pnpm build       # Build for production
pnpm start       # Start production server
```

### Code Quality

```bash
pnpm lint        # Run ESLint
pnpm lint:fix    # Fix ESLint issues automatically
pnpm format:check    # Check code formatting with Prettier
pnpm format:write    # Auto-format code with Prettier
pnpm test        # Run tests with Vitest
```

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Set required LiveKit credentials:
   - `LIVEKIT_API_KEY` - From LiveKit Cloud Dashboard
   - `LIVEKIT_API_SECRET` - From LiveKit Cloud Dashboard
   - `LIVEKIT_URL` - WebSocket URL (e.g., `wss://my-project.livekit.cloud`)

## Architecture Overview

### Core Application Structure

This is a Next.js 15 application using React 18 with LiveKit Components for video conferencing.

### Key Routes & Components

**Landing Page** (`/app/page.tsx`)

- Two tabs: Demo mode (free tier) and Custom connection (own LiveKit server)
- Generates room IDs and handles E2EE passphrase encoding
- Routes to either `/rooms/[roomName]` or `/custom/`

**Room Implementation** (`/app/rooms/[roomName]/`)

- `page.tsx`: Server component handling params and search params
- `PageClientImpl.tsx`: Main client component with PreJoin and video conference logic
- Supports classroom mode via URL params (`?classroom=true&role=teacher|student`)
- Smart defaults: Students join with mic/camera off, teachers with media on

**Custom Connection** (`/app/custom/`)

- For connecting with custom LiveKit servers using user-provided tokens
- Similar structure to rooms but bypasses internal token generation

### Token Generation & Permissions

**API Endpoint** (`/app/api/connection-details/route.ts`)

- Generates LiveKit JWT tokens with role-based permissions
- Three permission models:
  1. **Regular Room**: Full permissions for all participants
  2. **Teacher**: Full permissions + room admin + recording rights
  3. **Student**: Listen-only (no publish) but can use chat

Token structure includes metadata with role information for client-side UI adaptation.

### Classroom Feature Implementation

The codebase includes classroom features for educational use (Phases 1-2 complete):

**Phase 1 - Role-Based Access**:
- Token generation with teacher/student permissions
- Smart PreJoin defaults (students join with mic/camera off)
- Role badges and graceful error handling

**Phase 2 - Teacher-Shares-Link Flow**:
- URL shortcuts: `/s/[roomName]` for students, `/t/[roomName]` for teachers
- Copy Student Link button for teachers (floating top-right in conference)
- Optional PIN protection (4-6 digits)
- Enhanced student welcome experience

**Usage**:
- Teachers: Start classroom → optionally set PIN → share generated link
- Students: Click teacher's link → enter name → join as listener

**Testing**: Test utilities at `/test-classroom` with role selection UI

See `CLASSROOM_PHASE_1.md` and `CLASSROOM_PHASE_2.md` for implementation details.
See `CLASSROOM_ROADMAP.md` for next phases (Phase 3: Classroom Client ready to start).

### LiveKit Integration

**Client SDK** (`livekit-client`): Core WebRTC functionality
**React Components** (`@livekit/components-react`): Pre-built UI components
**Server SDK** (`livekit-server-sdk`): Token generation and API interactions
**Track Processors**: Krisp noise filter support when using LiveKit Cloud

### Component Library (`/lib/`)

- `SettingsMenu.tsx`: Audio/video device selection
- `RecordingIndicator.tsx`: Shows recording status
- `KeyboardShortcuts.tsx`: Hotkey support
- `client-utils.ts`: Room ID generation, E2EE encoding
- `getLiveKitURL.ts`: Multi-region URL routing

## Development Patterns

### Type Safety

- TypeScript strict mode enabled
- Custom types in `/lib/types.ts` for video codecs, connection details, classroom roles
- React component props use TypeScript interfaces

### Path Aliases

- Use `@/*` for absolute imports from project root
- Example: `import { generateRoomId } from '@/lib/client-utils'`

### State Management

- React hooks for local state
- URL params for room configuration (region, codec, quality)
- Cookies for participant identity persistence

### Error Handling

- Graceful media permission failures for students
- Try-catch blocks around camera/microphone enabling
- Connection error boundaries in video conference components

## Testing

### Running Tests

```bash
pnpm test              # Run all tests once
pnpm test --watch      # Watch mode for development
pnpm test [filename]   # Test specific file
```

Test files use `.test.ts` extension and are co-located with source files.

## Performance Optimizations

- Dynamic imports for heavy components
- Suspense boundaries for loading states
- Performance optimizer hook (`usePerfomanceOptimiser`) for adaptive quality
- Codec selection support (VP9, H264, AV1)

## Deployment Considerations

- Requires Node.js 18+
- Uses pnpm package manager (v10.9.0)
- Environment variables must be set for LiveKit connection
- Optional S3 configuration for recording storage
- Optional Datadog integration for monitoring
