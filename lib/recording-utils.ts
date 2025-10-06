import { createAdminClient } from './supabase/admin';

/**
 * Recording database utilities for LiveKit session recordings
 */

export interface Recording {
  id: string;
  room_sid: string;
  room_name: string;
  session_id: string;
  livekit_egress_id: string;
  hls_playlist_url: string | null;
  mp4_url: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  teacher_name: string;
  started_at: string;
  ended_at: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  classroom_id: string | null;
  created_by: string | null;
  metadata: any;
  created_at: string;
}

export interface TranslationEntry {
  id: string;
  recording_id: string;
  text: string;
  language: string;
  participant_name: string;
  timestamp_ms: number;
  created_at: string;
}

export interface Transcription {
  id: string;
  recording_id: string;
  text: string;
  language: string;
  participant_identity: string;
  participant_name: string;
  timestamp_ms: number;
  created_at: string;
}

/**
 * Generate unique session ID for recording
 * Format: ROOMCODE_YYYY-MM-DD_HH-MM
 * Example: MATH101_2025-01-30_14-30
 */
export function generateSessionId(roomName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-'); // HH-MM
  return `${roomName}_${date}_${time}`;
}

/**
 * Create recording record in database
 */
export async function createRecording(params: {
  roomSid: string;
  roomName: string;
  sessionId: string;
  egressId: string;
  teacherName: string;
  classroomId?: string;
  createdBy?: string;
  sessionUuid?: string; // Link to sessions table
}): Promise<Recording> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('session_recordings')
    .insert({
      room_sid: params.roomSid,
      room_name: params.roomName,
      session_id: params.sessionId,
      livekit_egress_id: params.egressId,
      teacher_name: params.teacherName,
      classroom_id: params.classroomId || null,
      created_by: params.createdBy || null,
      session_uuid: params.sessionUuid || null, // Link to session if exists
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create recording: ${error.message}`);
  return data as Recording;
}

/**
 * Update recording with egress results
 */
export async function updateRecording(
  recordingId: string,
  updates: {
    hls_playlist_url?: string;
    mp4_url?: string;
    duration_seconds?: number;
    size_bytes?: number;
    status?: 'ACTIVE' | 'COMPLETED' | 'FAILED';
    ended_at?: string;
  },
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('session_recordings').update(updates).eq('id', recordingId);

  if (error) throw new Error(`Failed to update recording: ${error.message}`);
}

/**
 * Get recording by ID
 */
export async function getRecording(recordingId: string): Promise<Recording | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('session_recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get recording: ${error.message}`);
  }
  return data as Recording;
}

/**
 * Get recording by egress ID
 */
export async function getRecordingByEgressId(egressId: string): Promise<Recording | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('session_recordings')
    .select('*')
    .eq('livekit_egress_id', egressId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get recording: ${error.message}`);
  }
  return data as Recording;
}

/**
 * Get all recordings for a room (excludes transcript-only entries)
 */
export async function getRoomRecordings(roomName: string): Promise<Recording[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('session_recordings')
    .select('*')
    .eq('room_name', roomName)
    .not('livekit_egress_id', 'like', 'transcript-%') // Filter out fake recordings
    .order('started_at', { ascending: false });

  if (error) throw new Error(`Failed to get recordings: ${error.message}`);
  return (data || []) as Recording[];
}

/**
 * Get all recordings (for dashboard) - excludes transcript-only entries
 */
export async function getAllRecordings(): Promise<Recording[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('session_recordings')
    .select('*')
    .not('livekit_egress_id', 'like', 'transcript-%') // Filter out fake recordings
    .order('started_at', { ascending: false });

  if (error) throw new Error(`Failed to get recordings: ${error.message}`);
  return (data || []) as Recording[];
}

/**
 * Save translation entry during live session (Phase 2 feature)
 */
export async function saveTranslationEntry(params: {
  recordingId: string;
  text: string;
  language: string;
  participantName: string;
  timestampMs: number;
}): Promise<TranslationEntry> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('translation_entries')
    .insert({
      recording_id: params.recordingId,
      text: params.text,
      language: params.language,
      participant_name: params.participantName,
      timestamp_ms: params.timestampMs,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save translation: ${error.message}`);
  return data as TranslationEntry;
}

/**
 * Get translations for playback (filtered by language and time range) - Phase 2 feature
 * Queries by session_id since translations are linked to sessions, not recordings
 */
export async function getRecordingTranslations(
  recordingId: string,
  language?: string,
): Promise<TranslationEntry[]> {
  const supabase = createAdminClient();

  // First, get the recording to find its session_uuid
  const { data: recording, error: recordingError } = await supabase
    .from('session_recordings')
    .select('session_uuid')
    .eq('id', recordingId)
    .single();

  if (recordingError || !recording?.session_uuid) {
    console.error(
      '[getRecordingTranslations] Recording or session not found:',
      recordingId,
      recordingError,
    );
    return [];
  }

  // Query translations by session_id (they're linked to sessions, not recordings)
  let query = supabase
    .from('translation_entries')
    .select('*')
    .eq('session_id', recording.session_uuid)
    .order('timestamp_ms', { ascending: true });

  if (language) {
    query = query.eq('language', language);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get translations: ${error.message}`);

  console.log('[getRecordingTranslations] Found translations:', {
    recordingId,
    sessionUuid: recording.session_uuid,
    language,
    count: data?.length || 0,
  });

  return (data || []) as TranslationEntry[];
}

/**
 * Save transcription entry (original speaker language) during live session
 */
export async function saveTranscription(params: {
  recordingId: string;
  text: string;
  language: string;
  participantIdentity: string;
  participantName: string;
  timestampMs: number;
}): Promise<Transcription> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('transcriptions')
    .insert({
      recording_id: params.recordingId,
      text: params.text,
      language: params.language,
      participant_identity: params.participantIdentity,
      participant_name: params.participantName,
      timestamp_ms: params.timestampMs,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save transcription: ${error.message}`);
  return data as Transcription;
}

/**
 * Get transcriptions for playback (original speaker language)
 * Queries by session_id since transcriptions are linked to sessions, not recordings
 */
export async function getRecordingTranscriptions(recordingId: string): Promise<Transcription[]> {
  const supabase = createAdminClient();

  // First, get the recording to find its session_uuid
  const { data: recording, error: recordingError } = await supabase
    .from('session_recordings')
    .select('session_uuid')
    .eq('id', recordingId)
    .single();

  if (recordingError || !recording?.session_uuid) {
    console.error(
      '[getRecordingTranscriptions] Recording or session not found:',
      recordingId,
      recordingError,
    );
    return [];
  }

  // Query transcriptions by session_id (they're linked to sessions, not recordings)
  const { data, error } = await supabase
    .from('transcriptions')
    .select('*')
    .eq('session_id', recording.session_uuid)
    .order('timestamp_ms', { ascending: true });

  if (error) throw new Error(`Failed to get transcriptions: ${error.message}`);

  console.log('[getRecordingTranscriptions] Found transcriptions:', {
    recordingId,
    sessionUuid: recording.session_uuid,
    count: data?.length || 0,
  });

  return (data || []) as Transcription[];
}
