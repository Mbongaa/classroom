import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { getClassroomByRoomCode, getOrganizationInfoById } from '@/lib/classroom-utils';
import { HostCapabilityConfigError, createHostCapability } from '@/lib/v2/host-capability';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { roomCode } = await params;
  const organizationId = auth.profile?.organization_id;

  if (!organizationId) {
    return NextResponse.json({ error: 'User profile is missing organization' }, { status: 400 });
  }

  try {
    const classroom = await getClassroomByRoomCode(roomCode, organizationId);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const orgInfo = await getOrganizationInfoById(classroom.organization_id);
    const hostToken = createHostCapability(classroom);
    const prefix = classroom.room_type === 'speech' ? '/v2/speech-t/' : '/v2/t/';
    const hostUrl = new URL(`${prefix}${encodeURIComponent(classroom.room_code)}`, request.nextUrl.origin);

    if (orgInfo?.slug) hostUrl.searchParams.set('org', orgInfo.slug);
    hostUrl.searchParams.set('host', hostToken);

    return NextResponse.json({ hostUrl: hostUrl.toString() });
  } catch (error) {
    if (error instanceof HostCapabilityConfigError) {
      return NextResponse.json(
        { error: 'Host link signing is not configured' },
        { status: 500 },
      );
    }

    console.error('[Host Link] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
