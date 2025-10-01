import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { requireTeacher } from '@/lib/api-auth';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  throw new Error('LiveKit environment variables are not set');
}

// Type assertions after validation - we know these are strings at this point
const API_KEY = LIVEKIT_API_KEY as string;
const API_SECRET = LIVEKIT_API_SECRET as string;
const URL = LIVEKIT_URL as string;

interface UpdatePermissionRequest {
  roomName: string;
  studentIdentity: string;
  studentName: string;
  action: 'grant' | 'revoke';
  teacherToken: string;
}

export async function POST(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    const body: UpdatePermissionRequest = await request.json();
    const { roomName, studentIdentity, studentName, action, teacherToken } = body;

    // Validate required fields
    if (!roomName || !studentIdentity || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: In production, validate teacher authorization with proper JWT verification
    // For now, we'll skip validation for simplicity

    // Create RoomServiceClient for updating metadata
    const roomService = new RoomServiceClient(URL, API_KEY, API_SECRET);

    // Determine new role based on action
    const updatedRole = action === 'grant' ? 'student_speaker' : 'student';

    // Update participant permissions dynamically without reconnection
    // This is the proper LiveKit way to handle permission changes
    try {
      // Update both metadata AND permissions atomically
      // The permissions parameter is the KEY to making this work without reconnection
      await roomService.updateParticipant(
        roomName,
        studentIdentity,
        // Metadata update (3rd parameter)
        JSON.stringify({
          role: updatedRole,
          permissionStatus: action,
          updatedAt: Date.now(),
        }),
        // Permissions update (4th parameter) - This is the critical part!
        {
          canPublish: action === 'grant', // Grant or revoke publishing capability
          canPublishData: true, // Always allow chat
          canSubscribe: true, // Always allow subscribing
          canUpdateOwnMetadata: false, // Don't allow metadata updates
        },
      );

      console.log(
        `Successfully updated permissions for ${studentIdentity}: canPublish=${action === 'grant'}`,
      );
    } catch (error) {
      console.error('Failed to update participant permissions:', error);
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }

    // Return success - NO TOKEN NEEDED since permissions are updated server-side
    return NextResponse.json({
      success: true,
      action,
      studentIdentity,
      updatedRole,
      notification: {
        type: action,
        message:
          action === 'grant'
            ? 'Your teacher has granted you speaking permission. You can now use your microphone and camera.'
            : 'Your speaking permission has been revoked.',
      },
    });
  } catch (error) {
    console.error('Error updating student permissions:', error);
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
  }
}
