import { RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const VERTEX_API_KEY = process.env.LIVEKIT_VERTEX_API_KEY;
const VERTEX_API_SECRET = process.env.LIVEKIT_VERTEX_API_SECRET;
const VERTEX_LIVEKIT_URL = process.env.LIVEKIT_VERTEX_URL;

export interface LiveKitCredentials {
  apiKey: string;
  apiSecret: string;
  url: string;
}

/**
 * Get LiveKit credentials based on language.
 * Arabic ('ar') → Bayaan server; all others → Vertex AI server.
 */
export function getCredentialsForLanguage(language: string): LiveKitCredentials {
  if (language === 'ar') {
    return {
      apiKey: API_KEY!,
      apiSecret: API_SECRET!,
      url: LIVEKIT_URL!,
    };
  }
  return {
    apiKey: VERTEX_API_KEY || API_KEY!,
    apiSecret: VERTEX_API_SECRET || API_SECRET!,
    url: VERTEX_LIVEKIT_URL || LIVEKIT_URL!,
  };
}

/**
 * Build a RoomServiceClient for the given language's LiveKit server.
 */
export function buildRoomServiceClient(language: string): RoomServiceClient {
  const creds = getCredentialsForLanguage(language);
  return new RoomServiceClient(creds.url, creds.apiKey, creds.apiSecret);
}

/**
 * Check if a LiveKit room exists by name.
 * Returns the room object if found, null otherwise.
 */
export async function verifyRoomExists(
  roomName: string,
  language: string,
): Promise<any | null> {
  const client = buildRoomServiceClient(language);
  const rooms = await client.listRooms([roomName]);
  return rooms.length > 0 ? rooms[0] : null;
}

/**
 * List current participants in a LiveKit room.
 */
export async function listRoomParticipants(
  roomName: string,
  language: string,
) {
  const client = buildRoomServiceClient(language);
  return client.listParticipants(roomName);
}

/**
 * Remove a specific participant from a room by identity.
 */
export async function removeStaleParticipant(
  roomName: string,
  identity: string,
  language: string,
) {
  const client = buildRoomServiceClient(language);
  return client.removeParticipant(roomName, identity);
}

/**
 * Delete a LiveKit room.
 */
export async function deleteRoom(roomName: string, language: string) {
  const client = buildRoomServiceClient(language);
  return client.deleteRoom(roomName);
}

/**
 * Create a LiveKit room with standard v2 settings.
 */
export async function createLiveKitRoom(
  roomName: string,
  language: string,
  emptyTimeout = 300,
) {
  const client = buildRoomServiceClient(language);
  return client.createRoom({
    name: roomName,
    emptyTimeout,
    metadata: '',
  });
}

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || 'bayaan-transcriber';

/**
 * Explicitly dispatch an agent to a room.
 * Works on existing rooms — no need to delete/recreate.
 */
export async function dispatchAgentToRoom(
  roomName: string,
  language: string,
  metadata?: string,
) {
  const creds = getCredentialsForLanguage(language);
  const client = new AgentDispatchClient(creds.url, creds.apiKey, creds.apiSecret);
  const dispatch = await client.createDispatch(roomName, AGENT_NAME, {
    metadata: metadata || '',
  });
  console.log(`[LiveKit] Dispatched agent "${AGENT_NAME}" to room ${roomName}`, dispatch);
  return dispatch;
}
