# LiveKit Implementation Checklist

**STOP! Do NOT write any LiveKit code until you complete this checklist.**

This checklist prevents hallucinated APIs, outdated patterns, and framework violations.

## 🔴 Pre-Implementation Verification (MANDATORY)

### Step 1: Version Check

```bash
# What versions are we using?
cat package.json | grep -E '"livekit-client"|"@livekit/components-react"'
```

- [ ] I have identified the exact LiveKit client version: \***\*\_\*\***
- [ ] I have identified the exact LiveKit React version: \***\*\_\*\***
- [ ] I have noted if versions are compatible with each other

### Step 1b: Concept Check (NEW)

**Before diving into implementation, check if there's a relevant concept:**

```yaml
Concept Sources to Check:
1. concept-registry.yml - Is this pattern documented?
2. project-context.yml - Does our project already use this?
3. Examples awareness:
   - Frontend patterns (Meet example)
   - AI patterns (Agents example)
   - Real-time patterns (Translation example)
```

- [ ] I have checked if this feature exists in our concept registry
- [ ] I understand the architectural pattern if a concept exists
- [ ] I know which example demonstrates this concept (if any)
- [ ] I will use the CONCEPT not the CODE from examples

### Step 2: Documentation Lookup via Context7

```typescript
// REQUIRED before ANY implementation
// Example for implementing screen share:

// Step 2a: Resolve library ID
const libraryId = await context7.resolveLibraryId({
  libraryName: 'livekit-client',
});

// Step 2b: Get documentation for specific feature
const docs = await context7.getLibraryDocs({
  context7CompatibleLibraryID: libraryId,
  topic: 'screen sharing', // Be specific!
  tokens: 5000,
});

// Step 2c: Review the returned documentation
// Look for:
// - Exact method names
// - Required parameters
// - Return types
// - Event names
// - Error handling patterns
```

- [ ] I have used Context7 to fetch current documentation
- [ ] I have found the exact API method/component I need
- [ ] I have verified the method signature matches my usage
- [ ] I have checked for any deprecation warnings

### Step 3: API Verification Checklist

#### For Room Operations:

- [ ] Verified `Room` constructor options in current version
- [ ] Checked `connect()` method signature and return type
- [ ] Confirmed event names (e.g., 'participantConnected' vs 'participant-connected')
- [ ] Verified `RoomOptions` interface properties

#### For Track Operations:

- [ ] Verified `createLocalVideoTrack()` / `createLocalAudioTrack()` signatures
- [ ] Checked `publishTrack()` parameters and options
- [ ] Confirmed `TrackPublishOptions` interface
- [ ] Verified track state property names

#### For Participant Operations:

- [ ] Checked participant property names (identity vs sid)
- [ ] Verified metadata structure and update methods
- [ ] Confirmed permission property names

#### For React Components:

- [ ] Verified component import paths
- [ ] Checked required vs optional props
- [ ] Confirmed hook names and return types
- [ ] Verified context provider requirements

### Step 4: Pattern Validation

- [ ] I have found an official example for this pattern OR a concept in our registry
- [ ] The example/concept is from the current major version
- [ ] I understand why the pattern works this way
- [ ] I'm not mixing patterns from different versions
- [ ] I've adapted the pattern for our classroom features (if applicable)

## 🟡 During Implementation

### Code Patterns to Verify:

#### Connection Pattern:

```typescript
// VERIFY: Is this still the correct pattern?
const room = new Room({
  // Check: Are these still the right options?
  adaptiveStream: true, // Does this property still exist?
  dynacast: true, // Is this still supported?
  // ... other options
});

// VERIFY: Method name and parameters
await room.connect(url, token); // Still async? Still these params?
```

#### Track Publishing Pattern:

```typescript
// VERIFY: Still the right way to create tracks?
const track = await createLocalVideoTrack({
  // Check: Are these still valid options?
  resolution: VideoPresets.h720.resolution, // VideoPresets still exists?
});

// VERIFY: Publishing method and options
await localParticipant.publishTrack(track, {
  // Check: Are these still valid publish options?
  simulcast: true, // Property name correct?
});
```

#### Event Handling Pattern:

```typescript
// VERIFY: Event names haven't changed
room.on('participantConnected', (participant) => {
  // Check: Event name exact match?
  // Check: Callback signature correct?
});
```

### Real-Time Checks:

- [ ] No TypeScript errors for LiveKit imports
- [ ] Autocomplete shows expected methods
- [ ] No console warnings about deprecated APIs
- [ ] No runtime errors about missing methods

## 🟢 Post-Implementation Verification

### Testing Checklist:

- [ ] Code compiles without LiveKit-related type errors
- [ ] Basic functionality works (connect, publish, subscribe)
- [ ] Events fire as expected
- [ ] Cleanup happens properly (no memory leaks)
- [ ] Error cases handled gracefully
- [ ] **NEW**: Works with our classroom mode (teacher AND student roles)
- [ ] **NEW**: Respects permission model from project-context.yml

### Documentation Cross-Reference:

- [ ] Implementation matches documentation examples OR concept patterns
- [ ] No use of undocumented features
- [ ] Following recommended error handling
- [ ] Using current best practices
- [ ] **NEW**: Documented which concept was used (if any)

## ⚠️ Red Flags That Require Investigation

**STOP if you encounter any of these:**

1. **Uncertainty about API**
   - "This should probably work..."
   - "I think this is the method..."
   - Can't find method in documentation

2. **Type Errors**
   - TypeScript complaining about LiveKit types
   - Properties don't exist on objects
   - Unexpected return types

3. **Runtime Errors**
   - "X is not a function"
   - "Cannot read property Y of undefined"
   - Events not firing

4. **Documentation Mismatches**
   - Your code doesn't match official examples
   - Can't find the pattern in current docs
   - Using patterns from blog posts/tutorials (might be outdated)

## 📋 Common API Changes to Watch For

**These frequently change between versions:**

### Method Name Changes:

- `setEnabled()` → `setMuted()` → `setEnabled()` (check current!)
- `addTrack()` → `publishTrack()`
- `removeTrack()` → `unpublishTrack()`

### Event Name Changes:

- Hyphenated vs camelCase (participant-connected vs participantConnected)
- Past vs present tense (connected vs connect)

### Option Property Changes:

- `autoSubscribe` → `autosubscribe`
- `publishDefaults` structure changes
- `videoCaptureDefaults` → `video.captureDefaults`

### Type/Interface Changes:

- `Participant` properties
- `Track` state enums
- `Room` connection states

## 🚀 Quick Verification Commands

```bash
# 1. Check what LiveKit exports (helps verify API exists)
npm ls livekit-client

# 2. Check TypeScript definitions
find node_modules/livekit-client -name "*.d.ts" | head -5

# 3. Quick version check
npm view livekit-client version

# 4. Check for updates
npm outdated | grep livekit
```

## 📚 Documentation Sources Priority

1. **Context7 MCP** (PRIMARY - always use first)
   - Real-time documentation
   - Version-specific information
   - Official patterns

2. **Concept Registry** (for architectural patterns)
   - .claude/livekit/concept-registry.yml
   - .claude/livekit/project-context.yml
   - .claude/livekit/concept-implementation-guide.md

3. **LiveKit Official Docs** (if Context7 unavailable)
   - https://docs.livekit.io
   - Check version selector!

4. **GitHub Examples** (for CONCEPTS ONLY)
   - https://github.com/livekit/client-sdk-js
   - Check example is for your version
   - Use for understanding patterns, NOT copying code

5. **TypeScript Definitions** (for exact types)
   - node_modules/livekit-client/dist/index.d.ts

**NEVER USE**:

- Old blog posts
- Stack Overflow answers (often outdated)
- ChatGPT/AI responses without verification
- Memory or assumptions
- **Example code directly** (concepts only!)

## Final Reminder

**If you're not 100% certain about an API, STOP and verify with Context7.**

Better to spend 2 minutes checking documentation than 2 hours debugging hallucinated code.
