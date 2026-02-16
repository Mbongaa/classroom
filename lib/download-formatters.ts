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
 * Bilingual entry: original transcription paired with its translation
 */
export interface BilingualEntry {
  original: string;
  translated: string;
  participant_name: string;
  timestamp_ms: number;
}

/**
 * Pair translations with their closest transcription by timestamp.
 * Each translation gets matched to the transcription with the nearest timestamp_ms.
 */
export function pairTranslationsWithTranscriptions(
  translations: TranscriptEntry[],
  transcriptions: TranscriptEntry[],
): BilingualEntry[] {
  if (transcriptions.length === 0) {
    // No transcriptions available — return translations only (original field empty)
    return translations.map((t) => ({
      original: '',
      translated: t.text,
      participant_name: t.participant_name,
      timestamp_ms: t.timestamp_ms,
    }));
  }

  return translations.map((translation) => {
    // Find the transcription with the closest timestamp
    let closest = transcriptions[0];
    let minDiff = Math.abs(translation.timestamp_ms - closest.timestamp_ms);

    for (let i = 1; i < transcriptions.length; i++) {
      const diff = Math.abs(translation.timestamp_ms - transcriptions[i].timestamp_ms);
      if (diff < minDiff) {
        minDiff = diff;
        closest = transcriptions[i];
      }
    }

    return {
      original: closest.text.trim(),
      translated: translation.text.trim(),
      participant_name: translation.participant_name,
      timestamp_ms: translation.timestamp_ms,
    };
  });
}

/**
 * Format bilingual entries to SRT — original line then translation line per cue
 */
export function formatBilingualToSRT(entries: BilingualEntry[]): string {
  if (!entries || entries.length === 0) return '';

  return entries
    .map((entry, index) => {
      const startTime = msToTimestamp(entry.timestamp_ms, 'srt');
      const endMs =
        index + 1 < entries.length
          ? entries[index + 1].timestamp_ms
          : entry.timestamp_ms + 3000;
      const endTime = msToTimestamp(endMs, 'srt');

      const lines = entry.original
        ? `${entry.original}\n${entry.translated}`
        : entry.translated;

      return `${index + 1}\n${startTime} --> ${endTime}\n${lines}\n`;
    })
    .join('\n');
}

/**
 * Format bilingual entries to VTT — original line then translation line per cue
 */
export function formatBilingualToVTT(entries: BilingualEntry[]): string {
  if (!entries || entries.length === 0) return 'WEBVTT\n';

  const cues = entries
    .map((entry, index) => {
      const startTime = msToTimestamp(entry.timestamp_ms, 'vtt');
      const endMs =
        index + 1 < entries.length
          ? entries[index + 1].timestamp_ms
          : entry.timestamp_ms + 3000;
      const endTime = msToTimestamp(endMs, 'vtt');

      const lines = entry.original
        ? `${entry.original}\n${entry.translated}`
        : entry.translated;

      return `${startTime} --> ${endTime}\n${lines}`;
    })
    .join('\n\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * Format bilingual entries to TXT — original line then translation line
 */
export function formatBilingualToTXT(entries: BilingualEntry[]): string {
  if (!entries || entries.length === 0) return '';

  return entries
    .map((entry) => {
      const timestamp = msToTimestamp(entry.timestamp_ms, 'txt');
      if (entry.original) {
        return `[${timestamp}]\n${entry.original}\n${entry.translated}`;
      }
      return `[${timestamp}]\n${entry.translated}`;
    })
    .join('\n\n');
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
