import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import {
  createClassroom,
  listClassrooms,
  type Classroom,
  type CreateClassroomParams,
} from '@/lib/classroom-utils';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// Validation regex for room code: 4-20 alphanumeric + hyphens
const ROOM_CODE_REGEX = /^[a-zA-Z0-9-]{4,20}$/;

/**
 * POST /api/classrooms
 * Create a new classroom (Supabase only - no LiveKit room created yet)
 */
export async function POST(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { user, profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: 'User profile is missing organization' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { roomCode, name, description, settings } = body;

    // Validation
    if (!roomCode || typeof roomCode !== 'string') {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    if (!ROOM_CODE_REGEX.test(roomCode)) {
      return NextResponse.json(
        { error: 'Room code must be 4-20 alphanumeric characters or hyphens' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Classroom name is required' }, { status: 400 });
    }

    // Validate settings if provided
    const classroomSettings = settings || {
      language: 'en',
      enable_recording: true,
      enable_chat: true,
      max_participants: 100,
    };

    // Create classroom in Supabase (LiveKit room created lazily on join)
    const classroom = await createClassroom({
      organizationId: profile.organization_id,
      roomCode: roomCode.trim(),
      teacherId: user.id,
      name: name.trim(),
      description: description?.trim(),
      settings: classroomSettings,
    });

    return NextResponse.json({
      success: true,
      classroom: {
        id: classroom.id,
        room_code: classroom.room_code,
        name: classroom.name,
        description: classroom.description,
        settings: classroom.settings,
        created_at: classroom.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating classroom:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create classroom' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/classrooms
 * List all classrooms for the authenticated teacher's organization
 */
export async function GET(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: 'User profile is missing organization' },
      { status: 400 }
    );
  }

  try {
    // Get classrooms from Supabase
    const classrooms = await listClassrooms(profile.organization_id);

    // Optionally enrich with LiveKit room data (participant counts)
    let enrichedClassrooms = classrooms;

    if (API_KEY && API_SECRET && LIVEKIT_URL) {
      try {
        const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
        const liveKitRooms = await roomService.listRooms();

        // Create a map of LiveKit rooms by name (classroom.id)
        const liveKitRoomMap = new Map();
        liveKitRooms.forEach((room) => {
          liveKitRoomMap.set(room.name, room);
        });

        // Enrich classrooms with live data
        enrichedClassrooms = classrooms.map((classroom) => {
          const liveKitRoom = liveKitRoomMap.get(classroom.id);

          return {
            ...classroom,
            numParticipants: liveKitRoom?.numParticipants || 0,
            isLive: !!liveKitRoom, // Whether LiveKit room currently exists
          };
        });
      } catch (error) {
        console.error('Error fetching LiveKit rooms:', error);
        // Continue without live data if LiveKit query fails
      }
    }

    return NextResponse.json({
      classrooms: enrichedClassrooms,
    });
  } catch (error: any) {
    console.error('Error listing classrooms:', error);
    return NextResponse.json(
      { error: 'Failed to list classrooms', details: error.message },
      { status: 500 }
    );
  }
}
