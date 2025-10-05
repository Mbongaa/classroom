import { LocalAudioTrack, LocalVideoTrack, videoCodecs } from 'livekit-client';
import { VideoCodec } from 'livekit-client';

export interface SessionProps {
  roomName: string;
  identity: string;
  audioTrack?: LocalAudioTrack;
  videoTrack?: LocalVideoTrack;
  region?: string;
  turnServer?: RTCIceServer;
  forceRelay?: boolean;
}

export interface TokenResult {
  identity: string;
  accessToken: string;
}

export function isVideoCodec(codec: string): codec is VideoCodec {
  return videoCodecs.includes(codec as VideoCodec);
}

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// Classroom-specific types
export type ClassroomRole = 'teacher' | 'student';

export interface ClassroomMetadata {
  role?: ClassroomRole;
  [key: string]: any;
}

// Persistent Rooms types (LEGACY - deprecated in favor of Classroom)
export type RoomType = 'meeting' | 'classroom' | 'speech';

export interface RoomMetadata {
  roomType: RoomType;
  teacherName?: string;
  language?: string;
  description?: string;
  createdBy?: string;
  createdAt: number;
}

export interface PersistentRoom {
  name: string; // Room code
  sid: string; // LiveKit room SID
  emptyTimeout: number; // Seconds before deletion when empty
  metadata: RoomMetadata;
  creationTime: number; // Unix timestamp
  numParticipants: number;
}

// Classroom types (Supabase-first architecture)
export interface ClassroomSettings {
  language: string;
  enable_recording: boolean;
  enable_chat: boolean;
  max_participants: number;
}

export interface Classroom {
  id: string; // UUID (also used as LiveKit room name)
  organization_id: string;
  room_code: string; // User-facing code (e.g., "MATH101")
  teacher_id: string;
  name: string; // Teacher/classroom name
  description: string | null;
  settings: ClassroomSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Optional fields from API enrichment
  numParticipants?: number;
  isLive?: boolean;
}

// Session and Recording types
export interface SessionMetadata {
  sessionId: string; // Human-readable session ID (e.g., "MATH101_2025-01-31_14-30")
  recordingId: string; // Database UUID for linking translations
  startTime: number; // Unix timestamp in milliseconds (for relative timestamp calculation)
  isRecording: boolean; // True if video recording is active
}

// Transcript types
export interface TranscriptSegment {
  participant_name: string; // Speaker name
  text: string; // Transcript text
  timestamp_ms: number; // Timestamp in milliseconds
  language: string; // Language code (e.g., "en", "ar", "es")
}
