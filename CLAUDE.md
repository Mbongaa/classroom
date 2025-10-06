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

- ✅ **NEW**: Zoom-like persistent room management
- Create reusable room codes (e.g., "MATH101") for recurring lectures
- LiveKit metadata-only architecture (no external database)
- Auto-population of teacher name and language (teachers only)
- Room management UI with create, list, delete operations
- 7-day empty timeout for room persistence
- See `PERSISTENT_ROOMS_IMPLEMENTATION.md` for complete details

### Token Generation & Permissions

**API Endpoint** (`/app/api/connection-details/route.ts`)

- Generates LiveKit JWT tokens with role-based permissions
- Three permission models:
  1. **Regular Room**: Full permissions for all participants
  2. **Teacher**: Full permissions + room admin + recording rights
  3. **Student**: Listen-only (no publish) but can use chat

Token structure includes metadata with role information for client-side UI adaptation.

### Classroom Feature Implementation

The codebase includes classroom features for educational use (Phases 1-6 complete, 55% of roadmap):

**Phase 1 - Role-Based Access**:

- Token generation with teacher/student permissions
- Smart PreJoin defaults (students join with mic/camera off)
- Role badges and graceful error handling

**Phase 2 - Teacher-Shares-Link Flow**:

- URL shortcuts: `/s/[roomName]` for students, `/t/[roomName]` for teachers
- Copy Student Link button for teachers (floating top-right in conference)
- Optional PIN protection (4-6 digits)
- Enhanced student welcome experience

**Phase 3 - Classroom Client UI**:

- Custom classroom layout with teacher spotlight and student grid
- Role-based UI with visual badges
- Translation sidebar for students
- Chat integration with LiveKit patterns

**Phase 4 - UI Enhancements & Bug Fixes**:

- Fixed audio routing and duplicate sections
- Speaking indicator for teacher
- Resizable sidebars (translation and chat)
- Unified dark theme
- LiveKit-compliant implementations

**Phase 5 - Teacher Permission Controls**:

- LiveKit updateParticipant API for dynamic permissions (best practice)
- Real-time permission updates without reconnection
- Portal-based dropdown UI (floating above all content)
- Grant/Revoke speaking permissions
- Remove participant functionality
- No token regeneration needed (server-side updates)

**Phase 6 - Student Request System (COMPLETED)**:

- Dual-mode request system (voice 🎤 or text 💬)
- Floating raise hand button for students
- Request mode selection modal
- Visual indicators on student avatars (✋ icon)
- Question bubbles for text display
- Teacher queue panel for request management
- Integration with Phase 5 permission system
- Real-time updates via LiveKit Data Channels

**Usage**:

- Teachers: Start classroom → optionally set PIN → share generated link
- Students: Click teacher's link → enter name → join as listener

**Testing**: Test utilities at `/test-classroom` with role selection UI

See `CLASSROOM_PHASE_1.md` through `CLASSROOM_PHASE_6_COMPLETED.md` for implementation details.
See `CLASSROOM_ROADMAP.md` for next phases (Phase 8: Interactive Learning Tools ready to start).

**Important Notes**:

- Translation sidebar exists but is UI-only (no actual translation functionality)
- Phase 7 (Permissions API) removed from roadmap as Phase 5 already implements this
- updateParticipant API confirmed as LiveKit best practice for dynamic permissions

### Translation System

The project includes two translation implementations:

1. **Local Translation Agent** (`translation_agent/`) - Development/testing agent using OpenAI
2. **Bayaan Server Integration** - Production-grade translation with Speechmatics + OpenAI

For details on using the superior Bayaan server for production, see: `BAYAAN_SERVER_INTEGRATION.md`

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

**CRITICAL**: Before creating ANY UI components, you MUST read and understand:

- **`LIVEKIT_CUSTOM_UI_INTEGRATION_GUIDE.md`** - Complete guide on proper LiveKit UI integration

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

**CRITICAL**: Claude Code is running in WSL (Linux subsystem), but the user operates in Windows.

### Command Execution Rules

**ALWAYS use Windows commands** when interacting with the project to avoid token waste on faulty Linux commands:

```bash
# ✅ CORRECT: Execute Windows commands from WSL
cmd.exe /c "cd C:\Users\HP\Desktop\meet && pnpm dev"
cmd.exe /c "type C:\Users\HP\Desktop\meet\.env.local"
powershell.exe -Command "Get-Process | Where-Object {\$_.ProcessName -like '*node*'}"

# ❌ WRONG: Linux commands that will fail or be inefficient
cat /mnt/c/Users/HP/Desktop/meet/.env.local  # Works but uses wrong environment
pnpm dev  # May use wrong Node version or WSL environment
```

### Path Conversion

- **WSL path**: `/mnt/c/Users/HP/Desktop/meet`
- **Windows path**: `C:\Users\HP\Desktop\meet`
- **Always use Windows paths** with `cmd.exe` and `powershell.exe`

### Common Command Patterns

```bash
# File operations
cmd.exe /c "type C:\path\to\file.txt"        # Read file
cmd.exe /c "dir C:\path\to\directory"        # List directory

# Development commands
cmd.exe /c "cd C:\Users\HP\Desktop\meet && pnpm install"
cmd.exe /c "cd C:\Users\HP\Desktop\meet && pnpm build"
cmd.exe /c "cd C:\Users\HP\Desktop\meet && pnpm dev"

# Process management
powershell.exe -Command "Get-Process | Where-Object {\$_.ProcessName -eq 'node'}"
powershell.exe -Command "Stop-Process -Name 'node' -Force"

# Environment checks
cmd.exe /c "node --version"
cmd.exe /c "pnpm --version"
cmd.exe /c "npx shadcn@latest --version"
```

### Why This Matters

- **Saves tokens**: Avoids retry cycles when Linux commands fail or use wrong environment
- **Correct environment**: Uses Windows Node.js, npm, pnpm installations (not WSL versions)
- **Process access**: Can interact with Windows processes (Claude Code, browsers, dev servers)
- **File system**: Ensures proper file permissions and line endings (CRLF vs LF)

### MCP Server Configuration

The `.mcp.json` file is configured for Windows environment:

- Uses `npx` (Windows executable, not WSL)
- Paths resolve correctly in Windows context
- MCP servers run in Windows Node.js environment
- Claude Code loads MCP servers from Windows paths
