import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';
import { getV2AuthenticatedUserContext, canHostClassroom } from '@/lib/v2/auth-context';
import {
  HostCapabilityConfigError,
  createHostCapability,
  verifyHostCapability,
} from '@/lib/v2/host-capability';

export async function GET(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  const requestUrl = new URL(request.url);
  const orgSlugParam = requestUrl.searchParams.get('org');
  const hostToken = requestUrl.searchParams.get('host');
  const postCallRedirect = requestUrl.searchParams.get('postCallRedirect');

  let organizationId: string | undefined;
  if (orgSlugParam) {
    try {
      const org = await getOrganizationBySlug(orgSlugParam);
      if (org) organizationId = org.id;
    } catch (error) {
      console.error('[V2 Teacher Redirect] Error resolving org slug:', error);
    }
  }

  try {
    const classroom = await getClassroomByRoomCode(roomCode, organizationId);
    if (!classroom) {
      return NextResponse.redirect(buildStudentUrl(request.url, roomCode, orgSlugParam, undefined, postCallRedirect));
    }

    if (hostToken && verifyHostCapability(hostToken, classroom)) {
      return NextResponse.redirect(
        buildTeacherUrl(request.url, roomCode, orgSlugParam, hostToken, classroom.room_type, postCallRedirect),
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const context = await getV2AuthenticatedUserContext(user.id);
      if (canHostClassroom(context, classroom)) {
        const freshHostToken = createHostCapability(classroom);
        return NextResponse.redirect(
          buildTeacherUrl(
            request.url,
            roomCode,
            orgSlugParam,
            freshHostToken,
            classroom.room_type,
            postCallRedirect,
          ),
        );
      }
    }

    return NextResponse.redirect(
      buildStudentUrl(request.url, roomCode, orgSlugParam, classroom.room_type, postCallRedirect),
    );
  } catch (error) {
    if (error instanceof HostCapabilityConfigError) {
      return NextResponse.json(
        { error: 'Host link signing is not configured' },
        { status: 500 },
      );
    }

    console.error('[V2 Teacher Redirect] Error:', error);
    return NextResponse.redirect(buildStudentUrl(request.url, roomCode, orgSlugParam, undefined, postCallRedirect));
  }
}

function buildTeacherUrl(
  baseUrl: string,
  roomCode: string,
  orgSlug: string | null,
  hostToken: string,
  roomType: string,
  postCallRedirect: string | null,
) {
  const isSpeech = roomType === 'speech';
  const url = new URL(`/v2/rooms/${encodeURIComponent(roomCode)}`, baseUrl);
  url.searchParams.set(isSpeech ? 'speech' : 'classroom', 'true');
  url.searchParams.set('role', 'teacher');
  if (orgSlug) url.searchParams.set('org', orgSlug);
  if (postCallRedirect) url.searchParams.set('postCallRedirect', postCallRedirect);
  url.searchParams.set('host', hostToken);
  return url;
}

function buildStudentUrl(
  baseUrl: string,
  roomCode: string,
  orgSlug: string | null,
  roomType = 'classroom',
  postCallRedirect: string | null = null,
) {
  const isSpeech = roomType === 'speech';
  const url = new URL(`/v2/rooms/${encodeURIComponent(roomCode)}`, baseUrl);
  url.searchParams.set(isSpeech ? 'speech' : 'classroom', 'true');
  url.searchParams.set('role', 'student');
  if (orgSlug) url.searchParams.set('org', orgSlug);
  if (postCallRedirect) url.searchParams.set('postCallRedirect', postCallRedirect);
  return url;
}
