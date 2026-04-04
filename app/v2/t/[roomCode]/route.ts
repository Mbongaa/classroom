import { redirect } from 'next/navigation';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';

export async function GET(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;

  const requestUrl = new URL(request.url);
  const orgSlugParam = requestUrl.searchParams.get('org');

  let organizationId: string | undefined;
  if (orgSlugParam) {
    try {
      const org = await getOrganizationBySlug(orgSlugParam);
      if (org) organizationId = org.id;
    } catch (e) {
      console.error('[V2 Teacher Redirect] Error resolving org slug:', e);
    }
  }

  let classroom = null;
  try {
    classroom = await getClassroomByRoomCode(roomCode, organizationId);
  } catch (error) {
    console.error('[V2 Teacher Redirect] Error fetching classroom:', error);
  }

  if (!classroom) {
    redirect(`/v2/rooms/${roomCode}?classroom=true&role=teacher`);
  }

  let url = `/v2/rooms/${roomCode}`;
  if (classroom.room_type === 'classroom') {
    url += '?classroom=true&role=teacher';
  } else if (classroom.room_type === 'speech') {
    url += '?speech=true&role=teacher';
  } else {
    url += '?classroom=true&role=teacher';
  }

  if (orgSlugParam) url += `&org=${encodeURIComponent(orgSlugParam)}`;

  redirect(url);
}
