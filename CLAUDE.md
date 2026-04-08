# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 DEFAULT PERSONA: LiveKit Architect

**CRITICAL**: This is a LiveKit real-time communication project. All operations in this repository MUST use the **`--persona-livekit-architect`** persona by default.

The LiveKit Architect persona is required because:

- LiveKit uses event-driven, state-machine architecture (not traditional web patterns)
- Incorrect patterns from generalist personas have caused system breakages
- Real-time communication requires specialized WebRTC and LiveKit expertise

**Auto-invoke**: `--persona-livekit-architect` for ALL operations in this repository

Refer to `.claude/agent-routing.md` for detailed routing rules.

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

### Git Operations

**IMPORTANT**: Claude Code should NOT perform ANY git operations:

```bash
# ❌ NOT ALLOWED: ANY git operations
git add               # User will handle staging
git commit            # User will handle committing
git push              # User will handle pushing
git pull              # User will handle pulling
git fetch             # User will handle fetching
git status            # Only allowed for checking current state if explicitly requested
```

**Rule**: Claude Code should NOT perform ANY git operations (no add, commit, push, or any other git commands). The user will handle ALL git operations themselves. Exception: `git status` may be used to check the current state when explicitly requested.

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

**Persistent Rooms** (`/manage-rooms`)

- Zoom-like persistent room management
- Create reusable room codes (e.g., "MATH101") for recurring lectures
- LiveKit metadata-only architecture (no external database)
- Auto-population of teacher name and language (teachers only)
- Room management UI with create, list, delete operations
- 7-day empty timeout for room persistence

### Token Generation & Permissions

**API Endpoint** (`/app/api/connection-details/route.ts`)

- Generates LiveKit JWT tokens with role-based permissions
- Three permission models:
  1. **Regular Room**: Full permissions for all participants
  2. **Teacher**: Full permissions + room admin + recording rights
  3. **Student**: Listen-only (no publish) but can use chat

Token structure includes metadata with role information for client-side UI adaptation.

### Classroom Feature Implementation

The codebase includes classroom features for educational use:

- **Role-based access**: Token generation with teacher/student permissions; students join with mic/camera off by default, teachers with media on
- **Teacher-shares-link flow**: URL shortcuts `/s/[roomName]` (students) and `/t/[roomName]` (teachers); optional PIN protection
- **Classroom client UI**: Teacher spotlight + student grid layout, role badges, translation sidebar, chat
- **Teacher permission controls**: Uses LiveKit `updateParticipant` API for real-time permission changes (no reconnect/token regeneration required); portal-based dropdown for grant/revoke speaking permissions and removing participants
- **Student request system**: Dual-mode (voice 🎤 or text 💬) raise-hand requests with avatar indicators, question bubbles, and a teacher queue panel; communicated via LiveKit Data Channels

**Usage**:

- Teachers: Start classroom → optionally set PIN → share generated link
- Students: Click teacher's link → enter name → join as listener

**Testing**: Test utilities at `/test-classroom` with role selection UI

### Translation System

Production translation runs through a separate **Bayaan server** (Speechmatics + OpenAI) located at `Translator Server_Arabic_Fusha/Bayaan-server/` (its own git repo). The classroom app communicates with it over LiveKit data channels.

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

### LiveKit UI Customization

**CRITICAL**: Before creating ANY UI components, read the LiveKit guidance in `.claude/livekit/` (foundation, patterns, integration points, troubleshooting).

**Key Principle**: "We provide the logic, you provide the presentation"

- **NEVER** override LiveKit CSS classes (`.lk-*`)
- **ALWAYS** use LiveKit hooks for logic with custom UI components
- **USE** Shadcn UI components with LiveKit hooks for consistent design

Example of correct pattern:

```typescript
// ✅ CORRECT: Use LiveKit hook with Shadcn UI
import { useTrackToggle } from '@livekit/components-react';
import { Button } from '@/components/ui/button';

const { toggle, isEnabled } = useTrackToggle({ source: Track.Source.Microphone });
return <Button onClick={toggle}>{isEnabled ? 'Mute' : 'Unmute'}</Button>;
```

### LiveKit Implementation Patterns

**IMPORTANT**: This codebase uses **valid and correct LiveKit SDK patterns**. There are two equally valid approaches for building LiveKit components:

#### Approach 1: Direct LiveKit Client SDK (Current Implementation ✅)

- Uses `createLocalVideoTrack()` and `createLocalAudioTrack()` from `livekit-client`
- Direct track management with proper lifecycle (create, use, cleanup)
- **This is an official LiveKit pattern** and is functionally correct
- Used in `/app/components/custom-prejoin/CustomPreJoin.tsx`

```typescript
// ✅ VALID: Direct SDK approach (current implementation)
import { createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
const videoTrack = await createLocalVideoTrack({ deviceId, resolution });
const audioTrack = await createLocalAudioTrack({ deviceId });
// Proper cleanup: track.stop()
```

#### Approach 2: LiveKit React Hooks (Alternative)

- Uses `usePreviewTracks()` or `useTrackToggle()` from `@livekit/components-react`
- Higher-level abstraction with built-in state management
- Convenient for customizing pre-built LiveKit components

```typescript
// ✅ ALSO VALID: React hooks approach (alternative)
import { usePreviewTracks } from '@livekit/components-react';
const tracks = usePreviewTracks(options, onError);
```

#### When to Use Each Approach:

- **Direct SDK**: For fully custom components where you need fine control (current PreJoin)
- **React Hooks**: When customizing pre-built LiveKit components or preferring hooks abstraction

**Current Implementation Status**: The custom PreJoin component correctly uses the Direct SDK approach with proper resource management. This is a valid LiveKit pattern and does not require refactoring.

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

## WSL-to-Windows Environment Configuration

**CRITICAL**: Claude Code runs in WSL (Linux subsystem), but the user operates in Windows. Run development commands through `cmd.exe` or `powershell.exe` so they use the Windows Node/pnpm installation, not the WSL one.

- **WSL path**: `/mnt/c/Users/hassa/OneDrive/Desktop/Bayaan.ai/classroom`
- **Windows path**: `C:\Users\hassa\OneDrive\Desktop\Bayaan.ai\classroom`

```bash
# Development commands
cmd.exe /c "cd C:\Users\hassa\OneDrive\Desktop\Bayaan.ai\classroom && pnpm install"
cmd.exe /c "cd C:\Users\hassa\OneDrive\Desktop\Bayaan.ai\classroom && pnpm dev"
cmd.exe /c "cd C:\Users\hassa\OneDrive\Desktop\Bayaan.ai\classroom && pnpm build"

# Process management
powershell.exe -Command "Get-Process | Where-Object {\$_.ProcessName -eq 'node'}"
powershell.exe -Command "Stop-Process -Name 'node' -Force"
```

The `.mcp.json` file is configured for the Windows environment and uses `npx` from the Windows PATH.
