import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClassroomByRoomCode, getOrganizationBySlug } from '@/lib/classroom-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
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
} from '@/lib/v2/livekit-helpers';


/**
 * POST /api/v2/connect
 *
 * Unified connect endpoint for v2 sessions.
 * - Looks up classroom config
 * - Validates LiveKit room state against DB (LiveKit = truth)
 * - Creates or reuses session
 * - Mints deterministic-identity token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      roomCode,
      participantName,
      role: requestedRole,
      orgSlug,
      mode,
      region,
    } = body as {
      roomCode: string;
      participantName: string;
      role: 'teacher' | 'student';
      orgSlug?: string;
      mode?: 'classroom' | 'speech';
      region?: string;
    };

    if (!roomCode || !participantName || !requestedRole) {
      return NextResponse.json(
        { error: 'Missing required fields: roomCode, participantName, role' },
        { status: 400 },
      );
    }

    // --- 1. Resolve authenticated user and org ---
    // Trust x-supabase-user-id from middleware (already validated via getUser
    // upstream). Skips a duplicate auth.getUser() round-trip to Supabase.
    const userId = request.headers.get('x-supabase-user-id') ?? undefined;
    const supabase = await createClient();

    let organizationId: string | undefined;
    let userRole: 'teacher' | 'student' = requestedRole;

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', userId)
        .single();

      if (profile) {
        organizationId = profile.organization_id;
        if (profile.role === 'teacher' || profile.role === 'admin') {
          userRole = 'teacher';
        } else {
          userRole = 'student';
        }
      }
    }

    // Fallback: resolve org from slug
    if (!organizationId && orgSlug) {
      const org = await getOrganizationBySlug(orgSlug);
      if (org) organizationId = org.id;
    }

    // --- 2. Look up classroom ---
    const classroom = await getClassroomByRoomCode(roomCode, organizationId);
    if (!classroom) {
      return NextResponse.json(
        { error: `Classroom not found: ${roomCode}` },
        { status: 404 },
      );
    }

    const language = classroom.settings?.language || 'en';
    const credentials = getCredentialsForLanguage(language);
    const livekitRoomName = classroom.id; // UUID, same as v1

    if (!credentials.url) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured for selected language' },
        { status: 500 },
      );
    }

    // --- 3. Build deterministic identity ---
    const identity = buildDeterministicIdentity(userRole, classroom.id, {
      userId,
      name: participantName,
    });

    // --- 4. Resolve or create v2 session (LiveKit = truth) ---
    let session = await getActiveV2Session(classroom.id);
    let isNewSession = false;

    if (session) {
      // Active session exists in DB — verify against LiveKit
      const room = await verifyRoomExists(livekitRoomName, language);

      if (room) {
        // Room exists — check if the agent is still present
        let hasAgent = false;
        try {
          const participants = await listRoomParticipants(livekitRoomName, language);
          hasAgent = participants.some((p: any) => p.kind === 1); // kind=1 = AGENT
        } catch {
          // listParticipants failed (room in transition) — assume no agent
        }

        if (hasAgent) {
          // Agent alive → reuse. DUPLICATE_IDENTITY kicks the ghost.
          console.log(`[V2 Connect] Reusing room with agent for ${roomCode} (session: ${session.id})`);
        } else {
          // Room alive but agent gone → explicitly dispatch a new agent to the existing room
          console.log(`[V2 Connect] Room exists but agent gone for ${roomCode} — dispatching agent`);
          try {
            await dispatchAgentToRoom(livekitRoomName, language);
          } catch (err) {
            console.error(`[V2 Connect] Agent dispatch failed:`, err);
          }
        }
      } else {
        // Room truly gone from LiveKit
        console.log(`[V2 Connect] Stale session for ${roomCode} — LiveKit room gone`);
        await transitionV2Session(session.id, 'ended', 'reaper');
        session = null;
      }
    }

    if (!session) {
      // No active session — create fresh LiveKit room + v2 session
      console.log(
        `[V2 Connect] Creating new session for ${roomCode} (${livekitRoomName}) on ${language === 'ar' ? 'Bayaan' : 'Vertex'}`,
      );
      await createLiveKitRoom(livekitRoomName, language, 300);
      session = await createV2Session(
        classroom.id,
        livekitRoomName,
        organizationId || null,
      );

      // Explicitly dispatch the agent — auto-dispatch is timing-sensitive and
      // unreliable when the room is created milliseconds before the user joins.
      // The same pattern is used in the existing-session branch above (line 142).
      try {
        await dispatchAgentToRoom(livekitRoomName, language);
      } catch (err) {
        console.error(`[V2 Connect] Agent dispatch failed for new session:`, err);
        // Non-blocking: user can still join, but translations may not work
        // until they reconnect (which will hit the existing-session fallback path)
      }

      isNewSession = true;
    }

    // If session was draining and a human is reconnecting, reactivate
    if (session.state === 'draining') {
      await transitionV2Session(session.id, 'active');
    }

    // --- 5. Record participant (fire-and-forget) ---
    // mintV2Token below does NOT depend on this row existing (it just signs a
    // JWT from identity/role/credentials). Don't block the response on it.
    void upsertV2Participant(session.id, identity, participantName, userRole).catch(
      (err) => console.error('[V2 Connect] upsertV2Participant failed:', err),
    );

    // --- 6. Mint token ---
    const token = await mintV2Token(
      identity,
      participantName,
      livekitRoomName,
      userRole,
      credentials,
      '30m',
    );

    // Track participation for authenticated users (fire-and-forget).
    // Uses admin client so the write doesn't depend on SSR cookie scope
    // surviving past the response return.
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

    console.log(`[V2 Connect] ${userRole} "${participantName}" → session ${session.id} (new: ${isNewSession})`);

    return NextResponse.json({
      serverUrl,
      participantToken: token,
      participantIdentity: identity,
      sessionId: session.id,
      livekitRoomName,
      isNewSession,
    });
  } catch (error) {
    console.error('[V2 Connect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
