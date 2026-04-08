/**
 * Per-speaker sentence accumulator that mirrors the Bayaan agent's
 * `extract_complete_sentences` algorithm (text_processing.py).
 *
 * Why this exists: the Bayaan STT agent emits each Speechmatics partial-final
 * as its own LiveKit TranscriptionSegment with a fresh UUID, `start_time=0`,
 * and just a chunk of text — NOT a complete sentence. The agent only produces
 * complete sentences server-side for translation; it never re-publishes them
 * as transcription. Without this accumulator, transcriptions get saved as
 * word-level rows and the bilingual `original_text` lookup ends up holding
 * only the last chunk that arrived.
 *
 * The shared singleton lets `TranscriptionSaver` (teacher) and
 * `SpeechTranslationPanel` (any role) cooperate via dedup-by-segment-id:
 * whichever component sees a chunk first inserts it; the other becomes a
 * no-op. The most-recently-completed sentence is then available to the
 * translation save path so the bilingual download has the right original.
 */

export interface ExtractResult {
  completeSentences: string[];
  remaining: string;
}

// Mirrors text_processing.py: ['.', '!', '?', '؟']
const SENTENCE_ENDINGS = new Set(['.', '!', '?', '؟']);
const SPLIT_REGEX = /([.!?؟])/;

/**
 * Split accumulated text into complete sentences (each ending with .!?؟)
 * and the trailing incomplete remainder. 1:1 port of the agent's algorithm.
 */
export function extractCompleteSentences(text: string): ExtractResult {
  if (!text || !text.trim()) return { completeSentences: [], remaining: '' };

  const parts = text.split(SPLIT_REGEX);
  const complete: string[] = [];
  let building = '';

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part.length === 1 && SENTENCE_ENDINGS.has(part)) {
      // Punctuation — completes the current accumulating sentence
      if (building.trim()) {
        complete.push(building.trim() + part);
        building = '';
      }
      // Orphan punctuation (no preceding text) is silently dropped, matching
      // the agent's behavior of skipping empty parts.
    } else {
      building = building ? building + ' ' + part : part;
    }
  }

  return { completeSentences: complete, remaining: building.trim() };
}

interface SpeakerBuffer {
  /** Raw incomplete-sentence text awaiting more chunks */
  accumulated: string;
  /** Sliding window of recently completed sentences (newest last) */
  recentSentences: string[];
  /** Wall-clock timestamp (ms) of the most recent chunk */
  lastUpdateMs: number;
  /** session-relative ms of the FIRST chunk in the current accumulating sentence */
  pendingStartMs: number | null;
  /** session-relative ms recorded for the most recently completed sentence */
  lastCompletedStartMs: number | null;
  /** LiveKit segment IDs we've already processed (dedup across components) */
  seenChunkIds: Set<string>;
}

const RECENT_HISTORY_LIMIT = 10;
const SEEN_IDS_LIMIT = 1000;
const SEEN_IDS_TRIM_TO = 500;

class SentenceAccumulator {
  private buffers = new Map<string, SpeakerBuffer>();

  private getBuf(key: string): SpeakerBuffer {
    let buf = this.buffers.get(key);
    if (!buf) {
      buf = {
        accumulated: '',
        recentSentences: [],
        lastUpdateMs: Date.now(),
        pendingStartMs: null,
        lastCompletedStartMs: null,
        seenChunkIds: new Set(),
      };
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /**
   * Append a raw chunk and return any sentences that became complete as a result.
   * Idempotent on `chunkId` so multiple subscribers can call it safely.
   *
   * @param key            Unique speaker key, e.g. `${sessionId}:${language}`
   * @param chunkId        LiveKit segment ID (used for dedup)
   * @param chunkText      Raw text from the agent
   * @param sessionTimeMs  Session-relative timestamp at the moment this chunk arrived
   */
  addChunk(
    key: string,
    chunkId: string,
    chunkText: string,
    sessionTimeMs: number,
  ): { completed: string[]; completedStartMs: number | null } {
    const buf = this.getBuf(key);

    if (chunkId && buf.seenChunkIds.has(chunkId)) {
      return { completed: [], completedStartMs: null };
    }
    if (chunkId) buf.seenChunkIds.add(chunkId);

    const text = chunkText.trim();
    if (!text) return { completed: [], completedStartMs: null };

    // Mark the start of a new accumulating sentence on the first chunk after a flush
    if (buf.pendingStartMs === null) {
      buf.pendingStartMs = sessionTimeMs;
    }

    buf.accumulated = buf.accumulated ? buf.accumulated + ' ' + text : text;
    buf.lastUpdateMs = Date.now();

    const { completeSentences, remaining } = extractCompleteSentences(buf.accumulated);

    let completedStartMs: number | null = null;
    if (completeSentences.length > 0) {
      completedStartMs = buf.pendingStartMs;
      buf.lastCompletedStartMs = buf.pendingStartMs;
      buf.recentSentences.push(...completeSentences);
      if (buf.recentSentences.length > RECENT_HISTORY_LIMIT) {
        buf.recentSentences = buf.recentSentences.slice(-RECENT_HISTORY_LIMIT);
      }
      buf.accumulated = remaining;
      // If anything spilled into `remaining`, that text starts a new sentence
      // whose timestamp begins right now (we don't know better).
      buf.pendingStartMs = remaining ? sessionTimeMs : null;
    }

    // Cap dedup memory growth on long sessions
    if (buf.seenChunkIds.size > SEEN_IDS_LIMIT) {
      const arr = Array.from(buf.seenChunkIds).slice(-SEEN_IDS_TRIM_TO);
      buf.seenChunkIds = new Set(arr);
    }

    return { completed: completeSentences, completedStartMs };
  }

  /**
   * Force-flush any incomplete accumulated text as if it were a complete sentence.
   * Used when the speaker pauses without ending punctuation.
   */
  flushRemaining(key: string): { sentence: string; startMs: number | null } | null {
    const buf = this.buffers.get(key);
    if (!buf || !buf.accumulated.trim()) return null;

    const sentence = buf.accumulated.trim();
    const startMs = buf.pendingStartMs;
    buf.recentSentences.push(sentence);
    if (buf.recentSentences.length > RECENT_HISTORY_LIMIT) {
      buf.recentSentences = buf.recentSentences.slice(-RECENT_HISTORY_LIMIT);
    }
    buf.lastCompletedStartMs = startMs;
    buf.accumulated = '';
    buf.pendingStartMs = null;
    buf.lastUpdateMs = Date.now();
    return { sentence, startMs };
  }

  /** The most recently completed sentence for this speaker, or '' if none. */
  getLastCompletedSentence(key: string): string {
    const buf = this.buffers.get(key);
    if (!buf || buf.recentSentences.length === 0) return '';
    return buf.recentSentences[buf.recentSentences.length - 1];
  }

  /** Session-relative start time of the most recently completed sentence, or null. */
  getLastCompletedStartMs(key: string): number | null {
    const buf = this.buffers.get(key);
    return buf?.lastCompletedStartMs ?? null;
  }

  /** Time (ms) since the last chunk was processed for this speaker. */
  getTimeSinceLastUpdate(key: string): number {
    const buf = this.buffers.get(key);
    if (!buf) return Infinity;
    return Date.now() - buf.lastUpdateMs;
  }

  /** Whether there is incomplete text awaiting a sentence boundary. */
  hasPendingText(key: string): boolean {
    const buf = this.buffers.get(key);
    return !!(buf && buf.accumulated.trim());
  }

  /** Drop all state for this speaker (call on session end / unmount). */
  reset(key: string): void {
    this.buffers.delete(key);
  }
}

export const sentenceAccumulator = new SentenceAccumulator();
