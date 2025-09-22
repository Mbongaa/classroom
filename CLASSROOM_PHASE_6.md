# CLASSROOM_PHASE_6.md - Student Request System with Voice/Text Options

## Phase 6 Implementation Plan

**Status**: Ready to Implement
**Priority**: High
**Estimated Effort**: 3-4 days
**Feature**: Dual-mode student request system allowing voice or text questions

## Overview

Phase 6 introduces a sophisticated student request system that gives students flexibility in how they ask questions. Students can choose between:
1. **Voice Mode**: Request speaking permission to ask verbally (joins main video grid)
2. **Text Mode**: Type their question which appears as a floating bubble

This system maintains classroom order while encouraging participation from all students, including those who may be shy or have connectivity issues that make voice difficult.

## User Experience Design

### Student Experience

#### 1. Initiating a Request
- Floating "Raise Hand" button (similar to translation button)
- Positioned on the right side of the screen (opposite from translation)
- Only visible to students (not teachers)
- Icon: ✋ or 🙋 with subtle animation

#### 2. Choosing Request Mode
When student clicks the raise hand button:
```
┌─────────────────────────────────┐
│     How would you like to ask    │
│         your question?           │
│                                  │
│   [🎤 Ask by Voice]              │
│   [💬 Ask by Text]               │
│                                  │
│         [Cancel]                 │
└─────────────────────────────────┘
```

#### 3A. Voice Mode Flow
1. Student selects "Ask by Voice"
2. Confirms request
3. ✋ indicator appears on their avatar (top-left corner)
4. Request sent to teacher's queue
5. If approved:
   - Receives permission notification
   - Automatically gains speaking permission
   - Joins main video grid with teacher
   - Can unmute and ask question
6. After speaking:
   - Teacher can revoke permission
   - Student returns to listening section

#### 3B. Text Mode Flow
1. Student selects "Ask by Text"
2. Text input modal appears:
```
┌─────────────────────────────────┐
│      Type your question:         │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                  │
│  [Submit Question]  [Cancel]     │
└─────────────────────────────────┘
```
3. Student types question and submits
4. ✋ indicator appears on their avatar (with different styling)
5. Question stored and associated with student
6. Clicking the indicator shows question bubble

### Teacher Experience

#### 1. Request Queue Panel
- Floating panel (can be minimized)
- Shows all pending requests
- Differentiates voice vs text requests with icons
- For text requests: Shows the actual question
- Actions: Approve/Decline/Mark as Answered

#### 2. Request Notification
```
┌─────────────────────────────────┐
│ 📋 Student Requests (3)          │
├─────────────────────────────────┤
│ 🎤 John Smith                    │
│    Wants to speak               │
│    [Approve] [Decline]          │
├─────────────────────────────────┤
│ 💬 Jane Doe                      │
│    "What page are we on?"       │
│    [Display] [Answered]         │
├─────────────────────────────────┤
│ 🎤 Bob Johnson                   │
│    Wants to speak               │
│    [Approve] [Decline]          │
└─────────────────────────────────┘
```

#### 3. Handling Requests
- **Voice Requests**:
  - Approve → Uses Phase 5 permission system
  - Student joins speaker grid automatically
- **Text Requests**:
  - Can display question to entire class
  - Mark as answered when complete
  - Question bubble visible to all when displayed

## Technical Implementation

### Component Architecture

```
ClassroomClientImpl.tsx
├── StudentRequestButton.tsx (Floating button)
├── RequestModeModal.tsx (Mode selection)
├── RequestIndicator.tsx (Avatar indicator)
├── QuestionBubble.tsx (Text display)
└── TeacherRequestPanel.tsx (Queue management)
```

### Data Flow

```typescript
// Request creation
Student → Creates Request → LiveKit Data Channel → All Participants

// Voice approval
Teacher → Approve Voice → updateParticipant API → Student Gets Permission

// Text display
Teacher → Display Text → Data Channel → Question Bubble Appears
```

### Key Data Structures

```typescript
interface StudentRequest {
  id: string;                    // Unique request ID
  studentIdentity: string;        // Student's LiveKit identity
  studentName: string;           // Display name
  type: 'voice' | 'text';        // Request type
  question?: string;             // Text content (for text mode)
  timestamp: number;             // When created
  status: 'pending' | 'approved' | 'answered' | 'declined';
}

interface RequestQueueState {
  requests: StudentRequest[];
  activeDisplayedQuestion: string | null; // Currently shown question
}
```

### LiveKit Integration

#### Data Channel Messages
```typescript
// Request submission
{
  type: 'STUDENT_REQUEST',
  payload: StudentRequest
}

// Teacher actions
{
  type: 'REQUEST_UPDATE',
  payload: {
    requestId: string,
    status: 'approved' | 'declined' | 'answered',
    action?: 'display' | 'hide'
  }
}
```

#### Permission Integration (Voice Mode)
- Reuses Phase 5's updateParticipant API
- Automatic permission grant when voice request approved
- Seamless transition to speaker grid

### Component Details

#### 1. StudentRequestButton.tsx
```typescript
- Floating button positioned right side
- Only renders for students
- Smooth animation on hover
- Opens RequestModeModal on click
- Shows active request state
```

#### 2. RequestModeModal.tsx
```typescript
- Modal with two primary options
- Voice mode: Simple confirmation
- Text mode: Includes textarea input
- Character limit for text questions (e.g., 200 chars)
- Validation before submission
```

#### 3. RequestIndicator.tsx
```typescript
- Overlays on student avatar (top-left corner)
- Different styles for voice/text
- Clickable for text requests
- Animated entrance
- Auto-cleanup when resolved
```

#### 4. QuestionBubble.tsx
```typescript
- Speech bubble design
- Points to student avatar
- Appears on click/hover of text indicator
- Can be displayed to all by teacher
- Auto-dismiss timer option
```

#### 5. TeacherRequestPanel.tsx
```typescript
- Draggable/minimizable panel
- Queue management interface
- Real-time updates
- Bulk actions (clear all, etc.)
- Sound notification option
```

## Styling Approach

### CSS Classes
```css
.studentRequestButton - Floating button
.requestModeModal - Selection modal
.requestIndicator - Avatar overlay
.requestIndicatorVoice - Voice request style
.requestIndicatorText - Text request style
.questionBubble - Text bubble
.teacherRequestPanel - Queue panel
```

### Visual Design
- Consistent with existing LiveKit theme
- Smooth animations for better UX
- Clear visual hierarchy
- Accessibility compliant (ARIA labels)
- Mobile responsive

## Implementation Steps

### Step 1: Create Base Components (Day 1)
- [ ] Create StudentRequestButton.tsx
- [ ] Create RequestModeModal.tsx
- [ ] Add basic styling
- [ ] Integrate with ClassroomClientImpl

### Step 2: Implement Request System (Day 2)
- [ ] Create request data structures
- [ ] Implement LiveKit Data Channel messaging
- [ ] Create RequestIndicator.tsx
- [ ] Add request queue state management

### Step 3: Teacher Interface (Day 3)
- [ ] Create TeacherRequestPanel.tsx
- [ ] Implement approval/decline logic
- [ ] Integrate with Phase 5 permissions (voice)
- [ ] Add notification system

### Step 4: Text Question Features (Day 4)
- [ ] Create QuestionBubble.tsx
- [ ] Implement question display logic
- [ ] Add "display to class" functionality
- [ ] Polish animations and transitions

## Testing Checklist

### Functional Tests
- [ ] Student can raise hand
- [ ] Mode selection works correctly
- [ ] Voice requests integrate with permissions
- [ ] Text questions display properly
- [ ] Teacher can manage queue
- [ ] Requests clear after handling
- [ ] Multiple simultaneous requests work

### Edge Cases
- [ ] Network disconnection during request
- [ ] Teacher leaves during active requests
- [ ] Maximum text length enforcement
- [ ] Rapid request creation/deletion
- [ ] Permission conflicts with Phase 5

### User Experience
- [ ] Smooth animations
- [ ] Clear visual feedback
- [ ] Intuitive workflow
- [ ] Mobile responsiveness
- [ ] Accessibility compliance

## Success Metrics

1. **Participation Rate**: Increase in student questions
2. **Response Time**: How quickly teachers address requests
3. **Mode Usage**: Ratio of voice vs text requests
4. **User Satisfaction**: Feedback on ease of use
5. **Technical Performance**: Latency and reliability

## Future Enhancements (Phase 6+)

1. **Question Categories**: Tag questions by topic
2. **Anonymous Questions**: Option for anonymity
3. **Question History**: Log of all questions asked
4. **AI Assistant**: Suggest answers to common questions
5. **Polls Integration**: Convert questions to quick polls
6. **Priority Queue**: Urgent vs normal questions
7. **Time Limits**: Auto-expire old requests

## Dependencies

- Phase 5 completion (permission system)
- LiveKit Data Channels
- React Hooks for state management
- CSS Modules for styling

## Notes

- This system is designed to be non-intrusive
- Teachers maintain full control over classroom
- Students have flexibility in participation style
- System scales to large classrooms (100+ students)
- All interactions are logged for analytics

---

**Next Phase**: Phase 7 (Removed) → Phase 8: Recording System