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

// Persistent Rooms types
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
  name: string;           // Room code
  sid: string;            // LiveKit room SID
  emptyTimeout: number;   // Seconds before deletion when empty
  metadata: RoomMetadata;
  creationTime: number;   // Unix timestamp
  numParticipants: number;
}
