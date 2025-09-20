# Classroom Feature Testing Guide - Phase 1

## Overview

This document provides testing instructions for Phase 1 of the classroom feature implementation, which adds role-based permissions (teacher/student) to LiveKit Meet.

## What's Been Implemented

### 1. Backend Changes

- **Modified**: `/app/api/connection-details/route.ts`
  - Added support for `classroom=true` and `role=teacher|student` query parameters
  - Teachers get full permissions including `roomAdmin` and `roomRecord`
  - Students get restricted permissions (no `canPublish`, but can still use chat)

### 2. Frontend Improvements (Fixed Student Issues)

- **Modified**: `/app/rooms/[roomName]/PageClientImpl.tsx`
  - PreJoin now detects classroom role and disables camera/mic for students by default
  - Added role indicator badge above PreJoin (Teacher/Student mode)
  - Conditional media enabling - students don't try to enable camera/mic
  - Graceful error handling for permission issues
  - No more confusing errors for students!

### 3. Type Definitions

- **Modified**: `/lib/types.ts`
  - Added `ClassroomRole` type ('teacher' | 'student')
  - Added `ClassroomMetadata` interface

### 4. Test Utilities

- **Created**: `/app/api/test-classroom/route.ts` - API endpoint for generating test URLs
- **Created**: `/app/test-classroom/page.tsx` - UI for testing classroom functionality

## Testing Instructions

### Method 1: Using the Test Page (Recommended)

1. Start the development server:

   ```bash
   pnpm dev
   ```

2. Navigate to: http://localhost:3000/test-classroom

3. Click the buttons to join as:
   - **Teacher**: Full permissions (can publish audio/video)
   - **Student**: Limited permissions (cannot publish audio/video)
   - **Regular Room**: Normal meeting (everyone has full permissions)

### Method 2: Direct URL Testing

1. Generate a room name (e.g., "test-room-123")

2. Open different URLs in different browsers:

   **Teacher URL** (Chrome):

   ```
   http://localhost:3000/rooms/test-room-123?classroom=true&role=teacher
   ```

   **Student URL** (Firefox):

   ```
   http://localhost:3000/rooms/test-room-123?classroom=true&role=student
   ```

   **Regular Room** (Edge):

   ```
   http://localhost:3000/rooms/test-room-123
   ```

### Method 3: Using the Test API

1. Call the test API:

   ```bash
   curl http://localhost:3000/api/test-classroom?roomName=my-test-room
   ```

2. Use the URLs provided in the response

## What to Verify

### ✅ Backward Compatibility

1. Regular rooms (without classroom params) should work exactly as before
2. All participants in regular rooms should have full permissions
3. No errors in console for regular room usage

### ✅ Teacher Permissions

When joining as a teacher, verify:

1. Camera button is enabled
2. Microphone button is enabled
3. Can turn on/off camera and microphone
4. Can share screen
5. Can use chat
6. Should see "roomAdmin: true" in token (if checking LiveKit dashboard)

### ✅ Student Permissions

When joining as a student, verify:

1. **Role badge shows** "👨‍🎓 Joining as Student (Listen-Only Mode)"
2. **PreJoin behavior**: Camera and mic toggles are OFF by default
3. **No permission prompts**: Browser doesn't ask for camera/mic access
4. **No errors**: Console should be clean, no permission errors
5. **In room**: Cannot turn on camera or microphone (buttons disabled)
6. **Chat works**: CAN still use chat functionality
7. **Token verification**: Should see "canPublish: false" in token

### ✅ Metadata

Check browser console and verify:

1. Participant metadata includes role information
2. Teacher metadata: `{ role: "teacher" }`
3. Student metadata: `{ role: "student" }`

## Browser Setup for Testing

To test multiple participants on the same machine:

1. **Use Different Browsers**
   - Chrome for teacher
   - Firefox for student #1
   - Edge for student #2

2. **Or Use Incognito/Private Windows**
   - Normal window for teacher
   - Incognito window for student

3. **Or Use Different Profiles**
   - Create multiple browser profiles
   - Each profile can access camera/mic independently

## Common Issues and Solutions

### Issue: Both participants have same permissions

**Solution**: Check that classroom parameters are being passed correctly in the URL

### Issue: Student can still turn on camera/mic

**Solution**: Clear browser cache and cookies, the token might be cached

### Issue: Camera/mic conflicts

**Solution**: Use different browsers or disable video for testing

### Issue: Token expired error

**Solution**: Tokens have 5-minute TTL, refresh the page to get a new token

## Debugging Tips

1. **Check Network Tab**
   - Look for `/api/connection-details` request
   - Verify it includes `classroom` and `role` parameters

2. **Check Console**
   - Look for any errors
   - Participant metadata should be logged

3. **LiveKit Dashboard** (if available)
   - Check participant permissions
   - Verify token grants match expected values

## Next Steps

Once Phase 1 is verified:

1. Phase 2: Create dedicated classroom UI routes
2. Phase 3: Add role selection to PreJoin component
3. Phase 4: Add teacher controls for managing students
4. Phase 5: Add "raise hand" functionality for students

## Important Notes

- Test pages (`/test-classroom`) are for development only
- Do not use in production without proper authentication
- Current implementation allows anyone to choose their role
- Production version should validate roles server-side
