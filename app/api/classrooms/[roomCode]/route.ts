import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { getClassroomByRoomCode, deleteClassroom, createClassroom } from '@/lib/classroom-utils';
import { RoomServiceClient } from 'livekit-server-sdk';
import { createClient } from '@/lib/supabase/client';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

/**
 * GET /api/classrooms/[roomCode]
 * Get classroom metadata by room code
 *
 * Includes lazy migration: If classroom doesn't exist in Supabase but exists
 * in LiveKit with metadata, automatically migrate it to Supabase.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const { roomCode } = await params;

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    // Optional auth - get organization context if available
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let organizationId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      organizationId = profile?.organization_id;
    }

    // Try to get classroom from Supabase
    let classroom = await getClassroomByRoomCode(roomCode, organizationId);

    // If not found in Supabase, check LiveKit for lazy migration
    if (!classroom && API_KEY && API_SECRET && LIVEKIT_URL) {
      try {
        const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
        const rooms = await roomService.listRooms([roomCode]);

        if (rooms.length > 0 && rooms[0].metadata) {
          // Parse old metadata format
          const metadata = JSON.parse(rooms[0].metadata);

          // Migrate to Supabase (requires user to be authenticated)
          if (user && organizationId && metadata.teacherName) {
            console.log(`Migrating legacy room ${roomCode} to Supabase`);

            try {
              classroom = await createClassroom({
                organizationId,
                roomCode,
                teacherId: user.id,
                name: metadata.teacherName || roomCode,
                description: metadata.description,
                settings: {
                  language: metadata.language || 'en',
                  enable_recording: metadata.roomType === 'classroom',
                  enable_chat: true,
                  max_participants: 100,
                },
              });
            } catch (migrationError: any) {
              console.error('Failed to migrate room:', migrationError);
              // If migration fails, still return the metadata
              return NextResponse.json({
                metadata: {
                  room_code: roomCode,
                  name: metadata.teacherName,
                  description: metadata.description,
                  settings: {
                    language: metadata.language || 'en',
                    enable_recording: false,
                    enable_chat: true,
                    max_participants: 100,
                  },
                },
                roomExists: true,
                migrated: false,
                note: 'Legacy room found but migration failed',
              });
            }
          } else {
            // Can't migrate without auth, return metadata anyway
            return NextResponse.json({
              metadata: {
                room_code: roomCode,
                name: metadata.teacherName || roomCode,
                description: metadata.description,
                settings: {
                  language: metadata.language || 'en',
                  enable_recording: false,
                  enable_chat: true,
                  max_participants: 100,
                },
              },
              roomExists: true,
              migrated: false,
              note: 'Legacy room found - requires authentication to migrate',
            });
          }
        }
      } catch (error) {
        console.error('Error checking LiveKit for legacy room:', error);
      }
    }

    // Return classroom if found
    if (classroom) {
      return NextResponse.json({
        classroom: {
          id: classroom.id,
          room_code: classroom.room_code,
          name: classroom.name,
          description: classroom.description,
          settings: classroom.settings,
          created_at: classroom.created_at,
        },
        roomExists: true,
        migrated: true,
      });
    }

    // Not found
    return NextResponse.json(
      {
        error: 'Classroom not found',
        roomExists: false,
      },
      { status: 404 },
    );
  } catch (error: any) {
    console.error('Error fetching classroom:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classroom', details: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/classrooms/[roomCode]
 * Soft delete a classroom (set is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { user, profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'User profile is missing organization' }, { status: 400 });
  }

  try {
    const { roomCode } = await params;

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    // Soft delete in Supabase
    await deleteClassroom(roomCode, user.id, profile.organization_id);

    // Optionally delete LiveKit room (or let it expire after 7 days)
    if (API_KEY && API_SECRET && LIVEKIT_URL) {
      try {
        // Get classroom to find its UUID (LiveKit room name)
        const classroom = await getClassroomByRoomCode(roomCode, profile.organization_id);

        if (classroom) {
          const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
          // Delete LiveKit room using the classroom UUID
          await roomService.deleteRoom(classroom.id);
        }
      } catch (error) {
        console.error('Error deleting LiveKit room:', error);
        // Continue even if LiveKit deletion fails - room will expire eventually
      }
    }

    return NextResponse.json({
      success: true,
      message: `Classroom ${roomCode} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting classroom:', error);

    return NextResponse.json(
      { error: 'Failed to delete classroom', details: error.message },
      { status: 500 },
    );
  }
}
