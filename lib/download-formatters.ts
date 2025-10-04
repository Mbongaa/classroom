/**
 * File format utilities for downloading transcriptions and translations
 * Supports SRT, VTT, and TXT formats
 */

export type FormatType = 'srt' | 'vtt' | 'txt';

export interface TranscriptEntry {
  text: string;
  participant_name: string;
  timestamp_ms: number;
}

/**
 * Convert milliseconds to timestamp format
 */
function msToTimestamp(ms: number, format: FormatType): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  if (format === 'srt') {
    // SRT format: HH:MM:SS,mmm
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  } else if (format === 'vtt') {
    // VTT format: HH:MM:SS.mmm
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  } else {
    // TXT format: HH:MM:SS (simpler)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

/**
 * Estimate end timestamp (start of next entry or +3 seconds default)
 */
function getEndTimestamp(
  currentIndex: number,
  entries: TranscriptEntry[],
  defaultDuration = 3000,
): number {
  if (currentIndex + 1 < entries.length) {
    return entries[currentIndex + 1].timestamp_ms;
  }
  return entries[currentIndex].timestamp_ms + defaultDuration;
}

/**
 * Format entries to SRT (SubRip) format
 */
export function formatToSRT(entries: TranscriptEntry[]): string {
  if (!entries || entries.length === 0) {
    return '';
  }

  return entries
    .map((entry, index) => {
      const startTime = msToTimestamp(entry.timestamp_ms, 'srt');
      const endTime = msToTimestamp(getEndTimestamp(index, entries), 'srt');
      const speaker = entry.participant_name || 'Unknown';
      const text = entry.text.trim();

      return `${index + 1}\n${startTime} --> ${endTime}\n[${speaker}]: ${text}\n`;
    })
    .join('\n');
}

/**
 * Format entries to VTT (WebVTT) format
 */
export function formatToVTT(entries: TranscriptEntry[]): string {
  if (!entries || entries.length === 0) {
    return 'WEBVTT\n';
  }

  const cues = entries
    .map((entry, index) => {
      const startTime = msToTimestamp(entry.timestamp_ms, 'vtt');
      const endTime = msToTimestamp(getEndTimestamp(index, entries), 'vtt');
      const speaker = entry.participant_name || 'Unknown';
      const text = entry.text.trim();

      return `${startTime} --> ${endTime}\n[${speaker}]: ${text}`;
    })
    .join('\n\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * Format entries to plain TXT format with timestamps
 */
export function formatToTXT(entries: TranscriptEntry[]): string {
  if (!entries || entries.length === 0) {
    return '';
  }

  return entries
    .map((entry) => {
      const timestamp = msToTimestamp(entry.timestamp_ms, 'txt');
      const speaker = entry.participant_name || 'Unknown';
      const text = entry.text.trim();

      return `[${timestamp}] ${speaker}: ${text}`;
    })
    .join('\n');
}

/**
 * Generate filename for download
 */
export function generateFilename(
  roomName: string,
  type: 'transcription' | 'translation',
  language: string,
  format: FormatType,
): string {
  // Sanitize room name for filename
  const sanitized = roomName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${sanitized}_${type}_${language}.${format}`;
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: FormatType): string {
  switch (format) {
    case 'srt':
      return 'application/x-subrip';
    case 'vtt':
      return 'text/vtt';
    case 'txt':
      return 'text/plain';
    default:
      return 'text/plain';
  }
}
