import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { getV2AuthenticatedUserContext, canHostClassroom } from '@/lib/v2/auth-context';
import { HostCapabilityConfigError, verifyHostCapability } from '@/lib/v2/host-capability';
import {
  getActiveV2Session,
  createV2Session,
  transitionV2Session,
  buildDeterministicIdentity,
  mintV2Token,
  upsertV2Participant,
} from '@/lib/v2/session-utils';
import {
  getCredentialsForLanguage,
  verifyRoomExists,
  createLiveKitRoom,
  listRoomParticipants,
  dispatchAgentToRoom,
  deleteRoom,
} from '@/lib/v2/livekit-helpers';

/**
 * POST /api/v2/connect
 *
 * Unified connect endpoint for v2 sessions.
 * - Looks up classroom config
 * - Grants teacher only from a host capability or authenticated org teacher/admin
 * - Validates LiveKit room state against DB (LiveKit = truth)
 * - Creates or reuses session
 * - Mints a scoped LiveKit token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      roomCode,
      participantName,
      role: requestedRole,
      orgSlug,
      region,
      hostToken,
    } = body as {
      roomCode: string;
      participantName: string;
      role: 'teacher' | 'student';
      orgSlug?: string;
      mode?: 'classroom' | 'speech';
      region?: string;
      hostToken?: string;
    };

    if (!roomCode || !participantName || !requestedRole) {
      return NextResponse.json(
        { error: 'Missing required fields: roomCode, participantName, role' },
        { status: 400 },
      );
    }

    // --- 1. Resolve authenticated user and org ---
    // Trust x-supabase-user-id from middleware, which strips spoofed inbound
    // values before setting the validated Supabase user id.
    const userId = request.headers.get('x-supabase-user-id') ?? undefined;
    const authContext = userId ? await getV2AuthenticatedUserContext(userId) : null;

    let organizationId: string | undefined;
    // Resolve org from the public URL first so logged-in users can still join
    // another mosque's public follower link as students.
    if (orgSlug) {
      const org = await getOrganizationBySlug(orgSlug);
      if (org) organizationId = org.id;
    }
    if (!organizationId && authContext?.organizationId) {
      organizationId = authContext.organizationId;
    }

    // --- 2. Look up classroom ---
    const classroom = await getClassroomByRoomCode(roomCode, organizationId);
    if (!classroom) {
      return NextResponse.json(
        { error: `Classroom not found: ${roomCode}` },
        { status: 404 },
      );
    }

    const hostTokenValid =
      requestedRole === 'teacher' ? verifyHostCapability(hostToken, classroom) : false;
    const authenticatedHost =
      requestedRole === 'teacher' && canHostClassroom(authContext, classroom);
    const userRole: 'teacher' | 'student' =
      requestedRole === 'teacher' && (hostTokenValid || authenticatedHost)
        ? 'teacher'
        : 'student';

    const language = classroom.settings?.language || 'en';
    const credentials = getCredentialsForLanguage(language);
    const livekitRoomName = classroom.id; // UUID, same as v1

    if (!credentials.url) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured for selected language' },
        { status: 500 },
      );
    }

    // --- 2.5. Reap any stale legacy LiveKit room for this classroom ---
    //
    // Pre-v2, the LiveKit room name was the human room_code. v2 uses
    // classroom.id instead. Reap an empty legacy room so it does not show as
    // an orphan forever, but never kick active users still on an old link.
    if (classroom.room_code && classroom.room_code !== classroom.id) {
      try {
        const legacyRoom = await verifyRoomExists(classroom.room_code, language);
        if (legacyRoom) {
          const numParticipants = Number(legacyRoom.numParticipants ?? 0);
          if (numParticipants === 0) {
            await deleteRoom(classroom.room_code, language);
            console.log(
              `[V2 Connect] Reaped stale legacy LiveKit room "${classroom.room_code}" for classroom ${classroom.id}`,
            );
          } else {
            console.warn(
              `[V2 Connect] Legacy LiveKit room "${classroom.room_code}" still has ${numParticipants} participant(s); leaving in place`,
            );
          }
        }
      } catch (err) {
        // Non-blocking: connect should still succeed even if reap fails.
        console.error('[V2 Connect] Legacy room reap failed:', err);
      }
    }

    // --- 3. Build participant identity ---
    const identity = buildDeterministicIdentity(userRole, classroom.id, {
      userId,
      name: participantName,
    });

    // --- 4. Resolve or create v2 session (LiveKit = truth) ---
    let session = await getActiveV2Session(classroom.id);
    let isNewSession = false;

    if (session) {
      const room = await verifyRoomExists(livekitRoomName, language);

      if (room) {
        let hasAgent = false;
        try {
          const participants = await listRoomParticipants(livekitRoomName, language);
          hasAgent = participants.some((p: any) => p.kind === 4 || p.kind === 'AGENT');
        } catch {
          // listParticipants failed while room is in transition; dispatch below.
        }

        if (hasAgent) {
          console.log(`[V2 Connect] Reusing room with agent for ${roomCode} (session: ${session.id})`);
        } else {
          console.log(`[V2 Connect] Room exists but agent gone for ${roomCode}; dispatching agent`);
          try {
            await dispatchAgentToRoom(livekitRoomName, language);
          } catch (err) {
            console.error('[V2 Connect] Agent dispatch failed:', err);
          }
        }
      } else {
        console.log(`[V2 Connect] Stale session for ${roomCode}; LiveKit room gone`);
        await transitionV2Session(session.id, 'ended', 'reaper');
        session = null;
      }
    }

    if (!session) {
      if (userRole === 'student') {
        return NextResponse.json(
          { error: 'No active session. Waiting for teacher to start the room.' },
          { status: 409 },
        );
      }

      console.log(
        `[V2 Connect] Creating new session for ${roomCode} (${livekitRoomName}) on ${language === 'ar' ? 'Bayaan' : 'Vertex'}`,
      );

      try {
        await createLiveKitRoom(livekitRoomName, language, 300);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/already exists|already_exist|exists/i.test(message)) {
          throw err;
        }
        console.log(`[V2 Connect] LiveKit room already exists for ${roomCode}; reusing`);
      }

      session = await createV2Session(
        classroom.id,
        livekitRoomName,
        organizationId || classroom.organization_id || null,
      );

      try {
        await dispatchAgentToRoom(livekitRoomName, language);
      } catch (err) {
        console.error('[V2 Connect] Agent dispatch failed for new session:', err);
      }

      isNewSession = true;
    }

    if (session.state === 'draining') {
      await transitionV2Session(session.id, 'active');
    }

    // This row is now part of the auth boundary: refresh/re-entry validates
    // against stored role/name instead of trusting client-supplied role.
    await upsertV2Participant(session.id, identity, participantName, userRole);

    const token = await mintV2Token(
      identity,
      participantName,
      livekitRoomName,
      userRole,
      credentials,
      '30m',
    );

    if (userId) {
      void createAdminClient()
        .from('classroom_participants')
        .upsert(
          {
            classroom_id: classroom.id,
            user_id: userId,
            role: userRole,
            last_attended_at: new Date().toISOString(),
          },
          { onConflict: 'classroom_id,user_id' },
        )
        .then(({ error }) => {
          if (error) {
            console.error('[V2 Connect] classroom_participants tracking failed:', error);
          }
        });
    }

    const serverUrl = region ? getLiveKitURL(credentials.url, region) : credentials.url;

    console.log(`[V2 Connect] ${userRole} "${participantName}" -> session ${session.id} (new: ${isNewSession})`);

    return NextResponse.json({
      serverUrl,
      participantToken: token,
      participantIdentity: identity,
      sessionId: session.id,
      livekitRoomName,
      isNewSession,
      grantedRole: userRole,
    });
  } catch (error) {
    console.error('[V2 Connect] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: error instanceof HostCapabilityConfigError ? 'Host link signing is not configured' : message },
      { status: 500 },
    );
  }
}
