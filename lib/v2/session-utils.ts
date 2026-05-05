import { createAdminClient } from '@/lib/supabase/admin';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import type { LiveKitCredentials } from './livekit-helpers';

// Valid state transitions for the session state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  active: ['draining', 'ended', 'failed'],
  draining: ['active', 'ended', 'failed'],
  // ended and failed are terminal
};

export interface V2Session {
  id: string;
  classroom_id: string;
  livekit_room_name: string;
  room_sid: string | null;
  state: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  human_count: number;
  agent_count: number;
  organization_id: string | null;
}

/**
 * Find the active (or draining) v2 session for a classroom.
 */
export async function getActiveV2Session(
  classroomId: string,
): Promise<V2Session | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v2_sessions')
    .select('*')
    .eq('classroom_id', classroomId)
    .in('state', ['active', 'draining'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[V2 Session] Error fetching active session:', error);
    return null;
  }
  return data;
}

/**
 * Create a new v2 session for a classroom.
 */
export async function createV2Session(
  classroomId: string,
  livekitRoomName: string,
  organizationId: string | null,
): Promise<V2Session> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v2_sessions')
    .insert({
      classroom_id: classroomId,
      livekit_room_name: livekitRoomName,
      state: 'active',
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const existing = await getActiveV2Session(classroomId);
      if (existing) return existing;
    }
    console.error('[V2 Session] Error creating session:', error);
    throw new Error(`Failed to create v2 session: ${error.message}`);
  }
  return data;
}

export async function getV2SessionById(sessionId: string): Promise<V2Session | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v2_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[V2 Session] Error fetching session:', error);
    return null;
  }
  return data;
}

/**
 * Transition a v2 session to a new state, respecting the state machine.
 * Returns true if transition succeeded, false if invalid.
 */
export async function transitionV2Session(
  sessionId: string,
  newState: string,
  reason?: string,
): Promise<boolean> {
  const supabase = createAdminClient();

  // Fetch current state
  const { data: session, error: fetchError } = await supabase
    .from('v2_sessions')
    .select('state')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    console.error('[V2 Session] Cannot transition - session not found:', sessionId);
    return false;
  }

  const currentState = session.state;

  // Terminal states cannot transition
  if (!VALID_TRANSITIONS[currentState]) {
    console.log(`[V2 Session] ${sessionId} already in terminal state: ${currentState}`);
    return false;
  }

  // Validate transition
  if (!VALID_TRANSITIONS[currentState].includes(newState)) {
    console.warn(
      `[V2 Session] Invalid transition: ${currentState} → ${newState} for ${sessionId}`,
    );
    return false;
  }

  const updateData: Record<string, unknown> = { state: newState };
  if (newState === 'ended' || newState === 'failed') {
    updateData.ended_at = new Date().toISOString();
    if (reason) updateData.ended_reason = reason;
  }

  const { error: updateError } = await supabase
    .from('v2_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('state', currentState); // optimistic concurrency guard

  if (updateError) {
    console.error('[V2 Session] Transition error:', updateError);
    return false;
  }

  console.log(`[V2 Session] ${sessionId}: ${currentState} → ${newState}${reason ? ` (${reason})` : ''}`);
  return true;
}

/**
 * Update participant counts on a session.
 */
export async function updateV2SessionCounts(
  sessionId: string,
  humanCount: number,
  agentCount: number,
) {
  const supabase = createAdminClient();
  await supabase
    .from('v2_sessions')
    .update({ human_count: humanCount, agent_count: agentCount })
    .eq('id', sessionId);
}

/**
 * Set the room_sid on a session (from room_started webhook).
 */
export async function setV2SessionRoomSid(sessionId: string, roomSid: string) {
  const supabase = createAdminClient();
  await supabase
    .from('v2_sessions')
    .update({ room_sid: roomSid })
    .eq('id', sessionId);
}

/**
 * Build a deterministic participant identity.
 */
export function buildDeterministicIdentity(
  role: 'teacher' | 'student' | 'translator',
  classroomId: string,
  opts: { userId?: string; name?: string; language?: string } = {},
): string {
  const shortId = classroomId.slice(0, 6);

  switch (role) {
    case 'teacher': {
      // Per-connect suffix prevents DUPLICATE_IDENTITY kicks when a single
      // teacher account is logged in from multiple devices (e.g. mosque
      // projection screen + imam's laptop). Without it, each new connect
      // boots the previous one and the room enters a connect-disconnect loop.
      // Trade-off: a genuinely stale ghost lingers until LiveKit's empty
      // timeout reaps it — same trade-off students already accept.
      const teacherSuffix = simpleHash(
        `${opts.userId || opts.name || 'teacher'}:${Date.now()}`,
      ).slice(0, 4);
      if (opts.userId) {
        return `teacher:${shortId}:${opts.userId.slice(0, 6)}:${teacherSuffix}`;
      }
      const nameHash = simpleHash(opts.name || 'teacher').slice(0, 8);
      return `teacher:${shortId}:${nameHash}:${teacherSuffix}`;
    }

    case 'student': {
      const safeName = (opts.name || 'student').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
      const suffix = simpleHash(`${opts.name}:${Date.now()}`).slice(0, 4);
      return `student:${shortId}:${safeName}:${suffix}`;
    }

    case 'translator':
      return `translator:${shortId}:${opts.language || 'en'}`;

    default:
      return `unknown:${shortId}:${Date.now()}`;
  }
}

/**
 * Mint a v2 access token.
 */
export async function mintV2Token(
  identity: string,
  name: string,
  roomName: string,
  role: 'teacher' | 'student',
  credentials: LiveKitCredentials,
  ttl = '30m',
): Promise<string> {
  const at = new AccessToken(credentials.apiKey, credentials.apiSecret, {
    identity,
    name,
    metadata: JSON.stringify({ role, v2: true }),
  });

  at.ttl = ttl;

  let grant: VideoGrant;
  if (role === 'teacher') {
    grant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
      roomAdmin: true,
      roomRecord: true,
    };
  } else {
    grant = {
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    };
  }

  at.addGrant(grant);
  return at.toJwt();
}

/**
 * Upsert a v2 participant record. Returns the participant row.
 */
export async function upsertV2Participant(
  sessionId: string,
  identity: string,
  name: string,
  role: string,
  language?: string,
) {
  const supabase = createAdminClient();

  // Try to reactivate an existing left participant first
  const { data: existing } = await supabase
    .from('v2_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('identity', identity)
    .eq('is_active', false)
    .order('left_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('v2_participants')
      .update({ is_active: true, left_at: null, joined_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (!error) return data;
  }

  // Insert new participant
  const insertData: Record<string, unknown> = {
    session_id: sessionId,
    identity,
    name,
    role,
    is_active: true,
  };
  if (language) insertData.language = language;

  const { data, error } = await supabase
    .from('v2_participants')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505') {
      const { data: dup } = await supabase
        .from('v2_participants')
        .select('*')
        .eq('session_id', sessionId)
        .eq('identity', identity)
        .eq('is_active', true)
        .single();
      return dup;
    }
    console.error('[V2 Participant] Insert error:', error);
    throw new Error(`Failed to insert v2 participant: ${error.message}`);
  }
  return data;
}

export interface V2Participant {
  id: string;
  session_id: string;
  identity: string;
  name: string;
  role: 'teacher' | 'student' | 'translator' | 'agent';
  language: string | null;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
}

export async function getV2ParticipantByIdentity(
  sessionId: string,
  identity: string,
): Promise<V2Participant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v2_participants')
    .select('*')
    .eq('session_id', sessionId)
    .eq('identity', identity)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[V2 Participant] Error fetching participant:', error);
    return null;
  }
  return data;
}

/**
 * Mark a participant as left.
 */
export async function markV2ParticipantLeft(sessionId: string, identity: string) {
  const supabase = createAdminClient();
  await supabase
    .from('v2_participants')
    .update({ is_active: false, left_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('identity', identity)
    .eq('is_active', true);
}

/**
 * Mark all active participants as left for a session.
 */
export async function markAllV2ParticipantsLeft(sessionId: string) {
  const supabase = createAdminClient();
  await supabase
    .from('v2_participants')
    .update({ is_active: false, left_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('is_active', true);
}

/**
 * Get active participant counts for a session (human vs agent).
 */
export async function getV2ParticipantCounts(
  sessionId: string,
): Promise<{ humanCount: number; agentCount: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('v2_participants')
    .select('role')
    .eq('session_id', sessionId)
    .eq('is_active', true);

  if (!data) return { humanCount: 0, agentCount: 0 };

  let humanCount = 0;
  let agentCount = 0;
  for (const p of data) {
    if (p.role === 'agent' || p.role === 'translator') {
      agentCount++;
    } else {
      humanCount++;
    }
  }
  return { humanCount, agentCount };
}

// Simple deterministic hash for identity generation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
