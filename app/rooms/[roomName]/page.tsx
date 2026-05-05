import * as React from 'react';
import { redirect } from 'next/navigation';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{
    // FIXME: We should not allow values for regions if in playground mode.
    region?: string;
    hq?: string;
    codec?: string;
    classroom?: string;
    speech?: string;
    role?: string;
    org?: string;
    pin?: string;
    quickstart?: string;
    speakerLanguage?: string;
    translationLanguage?: string;
  }>;
}) {
  const _params = await params;
  const _searchParams = await searchParams;

  // v2 forward guard.
  //
  // Anything that arrives here in classroom/speech mode is real classroom traffic
  // (not demo mode) and must go through the v2 stack — /api/v2/connect → v2_sessions.
  // The legacy entry routes (/t, /s, /speech-t, /speech-s) already redirect to /v2/*,
  // but a user pasting an old /rooms/<x>?classroom=true URL would otherwise still hit
  // the legacy /api/connection-details path. Forward those here as well.
  //
  // Demo-mode rooms (no classroom row) fall through to PageClientImpl untouched.
  const isClassroom = _searchParams.classroom === 'true';
  const isSpeech = _searchParams.speech === 'true';
  const isKhutbaQuickstart = _searchParams.quickstart === 'khutba' && isSpeech;
  if ((isClassroom || isSpeech) && !isKhutbaQuickstart) {
    let organizationId: string | undefined;
    if (_searchParams.org) {
      try {
        const org = await getOrganizationBySlug(_searchParams.org);
        if (org) organizationId = org.id;
      } catch (err) {
        console.error('[rooms/[roomName]] org lookup failed:', err);
      }
    }

    let classroom = null;
    try {
      classroom = await getClassroomByRoomCode(_params.roomName, organizationId);
    } catch (err) {
      console.error('[rooms/[roomName]] classroom lookup failed:', err);
    }

    if (classroom) {
      // Rebuild the query string verbatim — preserves classroom/speech, role, org, pin, etc.
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(_searchParams)) {
        if (typeof v === 'string') qs.set(k, v);
      }
      const search = qs.toString();
      redirect(`/v2/rooms/${_params.roomName}${search ? `?${search}` : ''}`);
    }
    // No classroom row → fall through to legacy renderer (treats as ad-hoc room).
  }

  const codec =
    typeof _searchParams.codec === 'string' && isVideoCodec(_searchParams.codec)
      ? _searchParams.codec
      : 'vp9';
  const hq = _searchParams.hq === 'true' ? true : false;

  return (
    <PageClientImpl
      roomName={_params.roomName}
      region={_searchParams.region}
      hq={hq}
      codec={codec}
    />
  );
}
