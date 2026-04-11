import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { TranscriptionSegment, RoomEvent, RemoteAudioTrack, ParticipantKind } from 'livekit-client';
import { Languages, Maximize2, Minimize2, Video, VideoOff, Volume2, VolumeX, ArrowDown, GripHorizontal } from 'lucide-react';
import { BotIcon } from '@/components/ui/bot';
import { isIOSDevice } from '@/lib/client-utils';
import { sentenceAccumulator } from '@/lib/sentence-accumulator';
import styles from './SpeechTranslationPanel.module.css';

interface SpeechTranslationPanelProps {
  targetLanguage: string;
  onClose?: () => void;
  hideCloseButton?: boolean;
  roomName: string;
  sessionStartTime: number;
  sessionId: string;
  userRole?: 'teacher' | 'student' | null;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  showVideo?: boolean;
  onVideoToggle?: () => void;
  translationApiUrl?: string; // V2 passes '/api/v2/translations'
  onResizePointerDown?: (e: React.PointerEvent) => void;
  controlBar?: React.ReactNode;
  participantCount?: number;
  onTranslationToggle?: () => void;
  showTranslation?: boolean;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second, exponential backoff

// Font size configuration
const DEFAULT_FONT_SIZE = 30;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 80;
const FONT_STEP = 2;

// Health check configuration
// If no transcription received for this duration, show warning
const TRANSLATION_TIMEOUT_MS = 15000; // 15 seconds

const SpeechTranslationPanel: React.FC<SpeechTranslationPanelProps> = ({
  targetLanguage,
  onClose,
  hideCloseButton = false,
  roomName,
  sessionStartTime,
  sessionId,
  userRole,
  isFullscreen = false,
  onFullscreenToggle,
  showVideo = true,
  onVideoToggle,
  translationApiUrl = '/api/recordings/translations',
  onResizePointerDown,
  controlBar,
  participantCount,
  onTranslationToggle,
  showTranslation = true,
}) => {
  const room = useRoomContext();
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [translatedSegments, setTranslatedSegments] = useState<
    Array<{
      id: string;
      speaker?: string;
      text: string;
      timestamp: number;
      isLatest?: boolean;
    }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);
  const autoScrollRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());
  const savedSegmentIds = useRef<Set<string>>(new Set()); // Track saved segments to prevent duplicates

  // Translation service health tracking
  const [translationServiceStatus, setTranslationServiceStatus] = useState<
    'connecting' | 'active' | 'warning'
  >('connecting');
  const healthTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Agent count tracking
  const [agentCount, setAgentCount] = useState(0);

  // Track agent participants in the room
  useEffect(() => {
    if (!room) return;

    const countAgents = () => {
      let count = 0;
      for (const p of room.remoteParticipants.values()) {
        if (p.kind === ParticipantKind.AGENT) count++;
      }
      setAgentCount(count);
    };

    // Count on room fully connected (catches already-present agents on rejoin)
    room.on(RoomEvent.Connected, countAgents);
    // Count when participants join or leave
    room.on(RoomEvent.ParticipantConnected, countAgents);
    room.on(RoomEvent.ParticipantDisconnected, countAgents);

    // Initial count + poll briefly for late-syncing participants
    countAgents();
    const retryTimer = setTimeout(countAgents, 2000);

    return () => {
      clearTimeout(retryTimer);
      room.off(RoomEvent.Connected, countAgents);
      room.off(RoomEvent.ParticipantConnected, countAgents);
      room.off(RoomEvent.ParticipantDisconnected, countAgents);
    };
  }, [room]);

  // Failsafe: if no agent appears within 10s of the room connecting,
  // trigger a server-side re-dispatch. Only fires once per room session.
  // Guards against race conditions, worker crashes, and dropped jobs.
  useEffect(() => {
    if (!room) return;

    let dispatched = false;
    let timer: NodeJS.Timeout | null = null;

    const armFailsafe = () => {
      if (timer || dispatched) return;
      timer = setTimeout(async () => {
        timer = null;
        if (dispatched) return;
        // Re-check current agent presence — state may have updated between
        // schedule and fire.
        let live = 0;
        for (const p of room.remoteParticipants.values()) {
          if (p.kind === ParticipantKind.AGENT) live++;
        }
        if (live > 0) return;

        dispatched = true;
        console.warn(
          '[Translation Failsafe] Agent missing 10s after join — triggering re-dispatch',
        );
        try {
          const res = await fetch('/api/v2/dispatch-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // room.name is the actual LiveKit room name = classroom UUID
            // (the `roomName` prop is the user-facing room code, which differs)
            body: JSON.stringify({ classroomId: room.name }),
          });
          if (!res.ok) {
            console.error('[Translation Failsafe] Re-dispatch failed:', res.status);
          }
        } catch (err) {
          console.error('[Translation Failsafe] Re-dispatch error:', err);
        }
      }, 10000);
    };

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // Arm on connect (covers both already-connected and future-connect cases)
    if (room.state === 'connected') armFailsafe();
    room.on(RoomEvent.Connected, armFailsafe);
    room.on(RoomEvent.Disconnected, cancel);

    return () => {
      cancel();
      room.off(RoomEvent.Connected, armFailsafe);
      room.off(RoomEvent.Disconnected, cancel);
    };
  }, [room]);

  // Translation service health monitoring
  useEffect(() => {
    if (!room) return;

    // Start health check timer - if no transcription within timeout, show warning
    const startHealthTimer = () => {
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
      healthTimeoutRef.current = setTimeout(() => {
        setTranslationServiceStatus('warning');
        console.warn('[Translation Health] ⚠️ No transcription received for', TRANSLATION_TIMEOUT_MS / 1000, 'seconds');
      }, TRANSLATION_TIMEOUT_MS);
    };

    // Start initial timer
    startHealthTimer();

    return () => {
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
    };
  }, [room]);

  // Listen for transcription events from the room
  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[]) => {
      // Reset health check timer on any transcription received
      if (healthTimeoutRef.current) {
        clearTimeout(healthTimeoutRef.current);
      }
      // Mark service as active when we receive any transcription
      setTranslationServiceStatus('active');
      // Restart the timer
      healthTimeoutRef.current = setTimeout(() => {
        setTranslationServiceStatus('warning');
        console.warn('[Translation Health] ⚠️ No transcription received for', TRANSLATION_TIMEOUT_MS / 1000, 'seconds');
      }, TRANSLATION_TIMEOUT_MS);

      // DEBUG: Log ALL incoming segments
      console.log(
        '[DEBUG SpeechTranslationPanel] Received segments:',
        segments.map((s) => ({
          id: s.id,
          language: s.language,
          text: s.text.substring(0, 50),
          final: s.final,
        })),
      );

      // Save translations for ANY role — DB-level dedup (segment_id unique index)
      // ensures only one row per segment per language regardless of how many clients save
      if (userRole) {
        const finalSegments = segments.filter((seg) => seg.final);

        // Detect speaker's original language
        // Teacher: local participant has speaking_language
        // Student: teacher is a remote participant
        const speakingLanguage =
          userRole === 'teacher'
            ? room.localParticipant?.attributes?.speaking_language
            : Array.from(room.remoteParticipants.values()).find(
                (p) => p.attributes?.speaking_language !== undefined,
              )?.attributes?.speaking_language;

        // Feed every original-language chunk into the shared accumulator. The
        // agent emits chunks (not sentences), so this is the only place we get
        // to reconstruct the full original sentence to denormalize onto the
        // translation row. Calls are idempotent on segment id, so it's safe
        // even when TranscriptionSaver is also feeding the same accumulator.
        if (speakingLanguage) {
          const speakerKey = `${sessionId}:${speakingLanguage}`;
          const sessionTimeMs = Date.now() - sessionStartTime;
          for (const seg of finalSegments) {
            if (seg.language === speakingLanguage && seg.text && seg.text.trim()) {
              sentenceAccumulator.addChunk(speakerKey, seg.id, seg.text, sessionTimeMs);
            }
          }
        }

        const translation = finalSegments.find((seg) => seg.language === targetLanguage);
        if (translation && translation.language !== speakingLanguage) {
          const segmentKey = `${translation.id}-${translation.language}`;
          if (!savedSegmentIds.current.has(segmentKey)) {
            savedSegmentIds.current.add(segmentKey);

            const participantName =
              room.localParticipant?.name || room.localParticipant?.identity || (userRole === 'teacher' ? 'Teacher' : 'Student');
            // The translation event fires AFTER all chunks of its source
            // sentence have been published, so the accumulator's last completed
            // sentence is the matching original. If accumulation hasn't found a
            // sentence boundary yet (e.g. punctuation never arrived), flush
            // whatever is pending so the bilingual download still has SOME
            // original text.
            const speakerKey = speakingLanguage ? `${sessionId}:${speakingLanguage}` : '';
            let originalText = speakerKey
              ? sentenceAccumulator.getLastCompletedSentence(speakerKey)
              : '';
            let originalStartMs = speakerKey
              ? sentenceAccumulator.getLastCompletedStartMs(speakerKey)
              : null;
            if (!originalText && speakerKey && sentenceAccumulator.hasPendingText(speakerKey)) {
              const flushed = sentenceAccumulator.flushRemaining(speakerKey);
              if (flushed) {
                originalText = flushed.sentence;
                originalStartMs = flushed.startMs;
              }
            }
            if (!originalText) {
              // Last-resort fallback: same-event ID match (rarely populated)
              originalText =
                finalSegments.find(
                  (seg) => seg.id === translation.id && seg.language === speakingLanguage,
                )?.text || '';
            }
            // Prefer the source sentence's start timestamp so the bilingual
            // SRT cue lines up with when the speaker actually started talking.
            // Fall back to wall-clock if the accumulator couldn't tell us.
            // The agent always sets translation.startTime=0, so it can't be used.
            const timestampMs = originalStartMs ?? Date.now() - sessionStartTime;

            // Save with retry logic
            const saveWithRetry = async (attempt = 1): Promise<void> => {
              try {
                const response = await fetch(translationApiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId,
                    text: translation.text,
                    language: translation.language,
                    participantName,
                    timestampMs,
                    segmentId: translation.id, // LiveKit segment ID for DB-level dedup
                    originalText,
                  }),
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  throw new Error(`API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                console.log(
                  `[SpeechTranslationPanel] ✅ ${userRole} saved TRANSLATION:`,
                  translation.language,
                  timestampMs,
                  'Entry ID:',
                  data.entry?.id,
                  data.duplicate ? '(duplicate ignored)' : '',
                );
              } catch (err) {
                console.error(
                  `[SpeechTranslationPanel] ❌ Save error (attempt ${attempt}/${MAX_RETRIES}):`,
                  err,
                );

                // Retry with exponential backoff
                if (attempt < MAX_RETRIES) {
                  const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                  console.log(`[SpeechTranslationPanel] Retrying in ${delay}ms...`);
                  await new Promise((resolve) => setTimeout(resolve, delay));
                  return saveWithRetry(attempt + 1);
                } else {
                  console.error(
                    '[SpeechTranslationPanel] ⚠️ FAILED after',
                    MAX_RETRIES,
                    'attempts. Data lost:',
                    {
                      text: translation.text.substring(0, 100),
                      timestamp: timestampMs,
                      sessionId,
                    },
                  );
                  savedSegmentIds.current.delete(segmentKey); // Allow retry on next segment
                }
              }
            };

            saveWithRetry();
          }
        }
      }

      // Filter segments for DISPLAY only (selected language)
      const filteredSegments = segments.filter((seg) => {
        return seg.language === targetLanguage && seg.final;
      });

      // Process new segments for display
      const newSegments = filteredSegments.map((seg, index) => ({
        id: seg.id || `seg-${Date.now()}-${index}`,
        speaker: 'Speaker',
        text: seg.text,
        timestamp: Date.now(),
        isLatest: false,
      }));

      if (newSegments.length > 0) {
        setTranslatedSegments((prev) => {
          // Add new segments and keep only last 100
          const updated = [...prev.map((s) => ({ ...s, isLatest: false })), ...newSegments];
          // Mark the last one as latest
          if (updated.length > 0) {
            updated[updated.length - 1].isLatest = true;
          }
          // Keep only last 100 segments to prevent memory issues
          if (updated.length > 100) {
            return updated.slice(-100);
          }
          return updated;
        });

        lastUpdateRef.current = Date.now();
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, targetLanguage, sessionId, sessionStartTime, userRole]);

  // User-intent tracking: only disable auto-scroll on explicit user interaction
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onInteractionStart = () => { userScrollingRef.current = true; };
    const onInteractionEnd = () => {
      setTimeout(() => { userScrollingRef.current = false; }, 150);
    };

    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

      if (userScrollingRef.current && distFromBottom > 150) {
        autoScrollRef.current = false;
        setShowScrollButton(true);
      }

      if (distFromBottom < 150) {
        autoScrollRef.current = true;
        setShowScrollButton(false);
      }
    };

    el.addEventListener('touchstart', onInteractionStart, { passive: true });
    el.addEventListener('touchend', onInteractionEnd, { passive: true });
    el.addEventListener('wheel', onInteractionStart, { passive: true });
    el.addEventListener('pointerup', onInteractionEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onInteractionStart);
      el.removeEventListener('touchend', onInteractionEnd);
      el.removeEventListener('wheel', onInteractionStart);
      el.removeEventListener('pointerup', onInteractionEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Auto-scroll synchronously after DOM mutation to avoid race with scroll events
  useLayoutEffect(() => {
    if (scrollRef.current && translatedSegments.length > 0 && autoScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [translatedSegments]);

  const scrollToLatest = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      autoScrollRef.current = true;
      setShowScrollButton(false);
    }
  }, []);

  // Audio mute toggle for students (iOS audio workaround)
  const toggleAudioMute = useCallback(() => {
    const newMuted = !isAudioMuted;
    const isIOS = isIOSDevice();

    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track) {
          (pub.track as RemoteAudioTrack).setVolume(newMuted ? 0 : 1);
        }
        if (isIOS) {
          pub.setSubscribed(!newMuted);
        }
      }
    }

    setIsAudioMuted(newMuted);
  }, [room, isAudioMuted]);

  // Auto-mute new audio tracks when muted state is active
  useEffect(() => {
    if (!room || !isAudioMuted) return;

    const handleTrackSubscribed = (track: { kind: string; setVolume?: (v: number) => void }) => {
      if (track.kind === 'audio' && track.setVolume) {
        track.setVolume(0);
        if (isIOSDevice()) {
          for (const p of room.remoteParticipants.values()) {
            for (const pub of p.audioTrackPublications.values()) {
              if (pub.track === track) pub.setSubscribed(false);
            }
          }
        }
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, isAudioMuted]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getLanguageLabel = (lang: string) => {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      'zh-CN': 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      pt: 'Portuguese',
      ru: 'Russian',
    };
    return languages[lang] || lang.toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Top header bar — also acts as vertical resize handle on mobile */}
      <div
        className={`${styles.topBar} ${onResizePointerDown ? styles.topBarResizable : ''}`}
        onPointerDown={onResizePointerDown}
      >
        <div className={styles.topBarLeft}>
          <Languages className={styles.bottomBarIcon} size={18} />
          <span className={styles.bottomBarTitle}>Live Translation</span>
        </div>
        {onResizePointerDown && (
          <GripHorizontal className={styles.topBarGrip} size={18} />
        )}
        <div className={styles.topBarRight}>
          {participantCount !== undefined && (
            <span className={styles.participantBadge} title={`${participantCount} participant(s)`}>
              {participantCount}
            </span>
          )}
          <span className={styles.languageBadge}>{getLanguageLabel(targetLanguage)}</span>
          <div
            className={`${styles.agentBadge} ${agentCount > 0 ? styles.agentBadgeActive : styles.agentBadgeInactive}`}
            title={`${agentCount} agent(s) in room`}
          >
            <BotIcon size={12} />
            <span>{agentCount}</span>
          </div>
          <div
            className={`${styles.liveIndicator} ${translationServiceStatus === 'warning' ? styles.warningIndicator : ''}`}
            title={translationServiceStatus === 'warning' ? 'Offline' : translationServiceStatus === 'connecting' ? 'Connecting' : 'Live'}
          >
            <span className={`${styles.liveDot} ${translationServiceStatus === 'warning' ? styles.warningDot : translationServiceStatus === 'connecting' ? styles.connectingDot : ''}`}></span>
          </div>
          {!hideCloseButton && onClose && (
            <button onClick={onClose} className={styles.closeButton}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Translation List */}
      <div className={styles.translationList} ref={scrollRef}>
        {translatedSegments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Languages className={styles.globeIcon} size={64} />
              <span className={styles.pulseRing}></span>
            </div>
            <div className={styles.emptyTitle}>Waiting for Translation</div>
            <div className={styles.emptyDescription}>
              Translations will appear here as the speaker talks
            </div>
            <div className={styles.languageIndicator}>
              <span className={styles.languageLabel}>Translating to</span>
              <span>{getLanguageLabel(targetLanguage)}</span>
            </div>
          </div>
        ) : (
          translatedSegments.map((segment) => (
            <div
              key={segment.id}
              className={`${styles.translationItem} ${segment.isLatest ? styles.latest : ''}`}
            >
              <div className={styles.translationText} style={{ fontSize: `${fontSize}px` }}>
                {segment.text}
              </div>
            </div>
          ))
        )}
      </div>

      {showScrollButton && translatedSegments.length > 0 && (
        <button
          className={styles.scrollToLatest}
          onClick={scrollToLatest}
          aria-label="Scroll to latest translation"
        >
          <ArrowDown size={18} />
        </button>
      )}

      {/* Bottom Bar - controls only */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomBarLeft}>
          {userRole === 'student' && (
            <button
              onClick={toggleAudioMute}
              className={`${styles.muteButton} ${isAudioMuted ? styles.muteButtonActive : ''}`}
              title={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
              aria-label={isAudioMuted ? 'Unmute teacher audio' : 'Mute teacher audio'}
            >
              {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isAudioMuted ? 'Muted' : 'Mute'}</span>
            </button>
          )}
          {translatedSegments.length > 0 && (
            <span className={styles.messageCountBadge}>{translatedSegments.length}</span>
          )}
        </div>
        {controlBar && !isFullscreen && <div className={styles.bottomBarCenter}>{controlBar}</div>}
        <div className={styles.bottomBarRight}>
          <div className={styles.fontControls}>
            <button
              onClick={() => setFontSize((prev) => Math.max(MIN_FONT_SIZE, prev - FONT_STEP))}
              disabled={fontSize <= MIN_FONT_SIZE}
              className={styles.fontButton}
              title="Decrease font size"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize((prev) => Math.min(MAX_FONT_SIZE, prev + FONT_STEP))}
              disabled={fontSize >= MAX_FONT_SIZE}
              className={styles.fontButton}
              title="Increase font size"
            >
              A+
            </button>
            {onVideoToggle && (
              <button
                onClick={onVideoToggle}
                className={styles.fontButton}
                title={showVideo ? 'Hide camera section' : 'Show camera section'}
              >
                {showVideo ? <Video size={14} /> : <VideoOff size={14} />}
              </button>
            )}
            {onFullscreenToggle && (
              <button
                onClick={() => {
                  if (!isFullscreen) {
                    document.documentElement.requestFullscreen?.();
                  } else if (document.fullscreenElement) {
                    document.exitFullscreen?.();
                  }
                  onFullscreenToggle();
                }}
                className={styles.fontButton}
                title={isFullscreen ? 'Exit presentation mode (Esc)' : 'Presentation mode'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
            {onTranslationToggle && (
              <button
                onClick={onTranslationToggle}
                className={`${styles.fontButton} ${showTranslation ? styles.fontButtonActive : ''}`}
                title={showTranslation ? 'Hide translation' : 'Show translation'}
              >
                <Languages size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechTranslationPanel;
