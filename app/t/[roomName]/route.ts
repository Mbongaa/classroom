import { redirect } from 'next/navigation';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // Parse org query param for organization-scoped lookup
  const requestUrl = new URL(request.url);
  const orgSlugParam = requestUrl.searchParams.get('org');

  // Resolve organization ID from slug if provided
  let organizationId: string | undefined;
  if (orgSlugParam) {
    try {
      const org = await getOrganizationBySlug(orgSlugParam);
      if (org) organizationId = org.id;
    } catch (e) {
      console.error('Error resolving org slug:', e);
    }
  }

  // Fetch classroom to determine room type
  try {
    const classroom = await getClassroomByRoomCode(roomName, organizationId);

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

    // Forward org param
    if (orgSlugParam) url += `&org=${encodeURIComponent(orgSlugParam)}`;

    redirect(url);
  } catch (error) {
    console.error('Error fetching classroom:', error);
    // Fallback to basic URL if fetch fails
    redirect(`/rooms/${roomName}?role=teacher`);
  }
}
