# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiveKit Meet - Open source video conferencing app built on LiveKit Components, LiveKit Cloud, and Next.js 15. This project is being extended to support a presenter-listener classroom architecture with real-time translation capabilities.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev                    # Starts at http://localhost:3000

# Build for production
pnpm build

# Run production server
pnpm start

# Code quality
pnpm lint                   # Run ESLint
pnpm lint:fix              # Auto-fix lint issues
pnpm format:check          # Check code formatting
pnpm format:write          # Auto-format code

# Testing
pnpm test                  # Run all tests with Vitest
```

## Architecture

### Core Stack

- **Framework**: Next.js 15.2.4 with App Router
- **LiveKit**: `@livekit/components-react` 2.9.14, `livekit-client` 2.15.7
- **Language**: TypeScript 5.9.2
- **Package Manager**: pnpm 10.9.0
- **Node**: >=18

### Project Structure

#### API Routes (`/app/api/`)

- **`connection-details/route.ts`**: Generates participant tokens with room access grants
  - Creates unique participant identity with random postfix
  - Handles room name, participant name, metadata, and region
  - Token TTL: 5 minutes with full publish/subscribe permissions

- **`record/start/route.ts`** & **`record/stop/route.ts`**: Recording management
  - Uses LiveKit Egress API for room composite recordings
  - Outputs to S3-compatible storage
  - Speaker layout by default

#### Room Pages (`/app/rooms/[roomName]/`)

- **`PageClientImpl.tsx`**: Main conference room implementation
  - PreJoin → Connection Details → VideoConference flow
  - Handles E2EE setup with external key provider
  - Configurable video codec (vp9, h264, vp8, av1)
  - HQ mode with adaptive streaming (up to 4K)
  - Low CPU optimization via `useLowCPUOptimizer`

#### Custom Connection (`/app/custom/`)

- **`VideoConferenceClientImpl.tsx`**: Direct token connection
  - Used when connecting with pre-generated tokens
  - Bypasses PreJoin flow
  - Immediate camera/microphone enablement

### Key Configuration

#### Room Options

```typescript
{
  videoCaptureDefaults: {
    resolution: hq ? VideoPresets.h2160 : VideoPresets.h720
  },
  publishDefaults: {
    videoSimulcastLayers: hq ? [h1080, h720] : [h540, h216],
    red: !e2eeEnabled,  // Redundancy encoding
    videoCodec: 'vp9' | 'h264' | 'vp8' | 'av1'
  },
  adaptiveStream: true,
  dynacast: true,
  e2ee: optional  // End-to-end encryption
}
```

#### Token Grants

```typescript
{
  room: roomName,
  roomJoin: true,
  canPublish: true,        // Will be role-based for presenter/listener
  canPublishData: true,    // Chat and reactions
  canSubscribe: true
}
```

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Required
LIVEKIT_API_KEY=           # From LiveKit Cloud Dashboard
LIVEKIT_API_SECRET=        # From LiveKit Cloud Dashboard
LIVEKIT_URL=               # wss://your-project.livekit.cloud

# Optional
NEXT_PUBLIC_SHOW_SETTINGS_MENU=true  # Enable Krisp noise filters
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record  # Recording endpoint

# Recording Storage (S3-compatible)
S3_KEY_ID=
S3_KEY_SECRET=
S3_ENDPOINT=
S3_BUCKET=
S3_REGION=
```

## Key Features & Implementation Details

### E2EE (End-to-End Encryption)

- Uses `ExternalE2EEKeyProvider` with shared passphrase
- Passphrase encoded in URL hash (e.g., `#passphrase`)
- Incompatible with av1/vp9 codecs when enabled
- Requires browser support check

### Connection Flow

1. **Landing Page**: Choose Demo (auto-generated room) or Custom (manual token)
2. **PreJoin**: Configure username, devices, optionally E2EE
3. **Token Generation**: Server creates JWT with participant identity
4. **Room Connection**: Establish WebRTC connection with LiveKit server
5. **Media Publishing**: Enable camera/microphone based on PreJoin choices

### Performance Optimizations

- **Adaptive Streaming**: Adjusts quality based on bandwidth
- **Dynacast**: Pauses video layers when not visible
- **Simulcast**: Multiple quality layers for optimal viewing
- **Low CPU Mode**: Automatic detection and optimization
- **RED**: Redundancy encoding for audio quality

### Security Headers

```javascript
// next.config.js
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

Required for SharedArrayBuffer (E2EE and certain features)

## Presenter-Listener Integration Plan

### Current State

The app currently gives all participants full publish permissions. The integration plan (from parent CLAUDE.md) outlines adding:

1. **Role-based permissions**: Presenter can publish, listeners can only subscribe
2. **Python agent**: For transcription/translation via Deepgram and OpenAI
3. **Caption UI**: Real-time translated captions overlay
4. **Classroom features**: Raise hand, presenter queue, etc.

### Key Integration Points

- Modify `connection-details/route.ts` to accept `isPresenter` parameter
- Update `PreJoin` component to include role selection
- Conditionally render controls based on participant role
- Add transcription event listeners (`RoomEvent.TranscriptionReceived`)

## Testing Considerations

### Multi-participant Testing

When testing multiple roles on the same machine:

- Use different browsers (Chrome/Firefox/Edge)
- Use incognito/private windows
- Test with audio-only to avoid camera conflicts
- Consider virtual camera/microphone tools

### Browser Requirements

- WebRTC support required
- SharedArrayBuffer support for E2EE
- Modern browser versions recommended

## Important Notes

1. **Token Security**: Current implementation allows anyone with room name to generate tokens. Add authentication for production.

2. **Recording Security**: Recording endpoints lack authentication - add proper authorization for production.

3. **React Strict Mode**: Disabled in next.config.js for LiveKit compatibility.

4. **Source Maps**: Production source maps enabled for debugging.

5. **Path Aliases**: Use `@/` for project root imports (configured in tsconfig.json).

6. **Cookie Management**: Participant postfix stored in HTTP-only cookie for 2 hours to maintain identity across refreshes.

7. **Error Handling**: Connection errors displayed via alert() - consider better UX for production.

## Common Development Tasks

### Adding a New API Route

1. Create route in `/app/api/[endpoint]/route.ts`
2. Use Next.js 15 route handlers (GET, POST, etc.)
3. Access LiveKit SDK via `livekit-server-sdk`

### Modifying Room Behavior

1. Edit `PageClientImpl.tsx` for room-specific changes
2. Update `VideoConference` props for UI modifications
3. Adjust `RoomOptions` for media configuration

### Custom UI Components

1. Place in `/lib/` directory
2. Use `@livekit/components-react` hooks and contexts
3. Access room via `RoomContext`

### Testing Locally

1. Set up `.env.local` with LiveKit Cloud credentials
2. Run `pnpm dev`
3. Generate room: `http://localhost:3000/rooms/[any-name]`
4. Test E2EE: Add `#your-passphrase` to room URL
