import { redirect } from 'next/navigation';
import { getClassroomByRoomCode } from '@/lib/classroom-utils';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // ✅ FIX: Fetch classroom to determine room type
  try {
    const classroom = await getClassroomByRoomCode(roomName);

    if (!classroom) {
      // Room not found - redirect without special params
      redirect(`/rooms/${roomName}?role=teacher`);
    }

    // Generate URL based on room type
    let url = `/rooms/${roomName}`;

    if (classroom.room_type === 'classroom') {
      url += '?classroom=true&role=teacher';
    } else if (classroom.room_type === 'speech') {
      url += '?speech=true&role=teacher';
    } else {
      // 'meeting' type - no special params needed
      url += '?role=teacher';
    }

    redirect(url);
  } catch (error) {
    console.error('Error fetching classroom:', error);
    // Fallback to basic URL if fetch fails
    redirect(`/rooms/${roomName}?role=teacher`);
  }
}
