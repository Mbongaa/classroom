import { NextRequest, NextResponse } from 'next/server';
import { generateRoomId } from '@/lib/client-utils';

// This is a test endpoint for generating classroom room URLs
// NOT FOR PRODUCTION - just for testing token generation

export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get('role') ?? 'student';
    const roomName = request.nextUrl.searchParams.get('roomName') ?? generateRoomId();

    // Generate test URLs for different scenarios
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${request.headers.get('host')}`
      : `http://${request.headers.get('host')}`;

    const testUrls = {
      regularRoom: `${baseUrl}/rooms/${roomName}`,
      teacherUrl: `${baseUrl}/rooms/${roomName}?classroom=true&role=teacher`,
      studentUrl: `${baseUrl}/rooms/${roomName}?classroom=true&role=student`,

      // Info about what will happen
      info: {
        regularRoom: "Regular room - everyone has full permissions",
        teacherUrl: "Teacher - can publish audio/video, has admin rights",
        studentUrl: "Student - cannot publish audio/video initially, can use chat",
      },

      // Debug info
      debug: {
        roomName,
        requestedRole: role,
        testInstructions: [
          "1. Open the teacher URL in one browser (e.g., Chrome)",
          "2. Open the student URL in another browser (e.g., Firefox)",
          "3. Verify that teacher can turn on camera/mic",
          "4. Verify that student cannot turn on camera/mic",
          "5. Verify both can use chat",
          "6. Check LiveKit dashboard to see permission grants"
        ]
      }
    };

    return NextResponse.json(testUrls, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'This is a test endpoint only'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}