'use client';

import React from 'react';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ClassroomClientImplWithRequests as ClassroomClientImpl } from '@/app/rooms/[roomName]/ClassroomClientImplWithRequests';
import { SpeechClientImplWithRequests as SpeechClientImpl } from '@/app/rooms/[roomName]/SpeechClientImplWithRequests';
import CustomPreJoin from '@/app/components/custom-prejoin/CustomPreJoin';
import { QRCodeCanvas } from 'qrcode.react';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
import { CopyIcon, type CopyIconHandle } from '@/components/ui/copy';
import { DownloadIcon, type DownloadIconHandle } from '@/components/ui/download';
import { QrCodeIcon, type QrCodeIconHandle } from '@/components/ui/qr-code';
import styles from '@/app/rooms/[roomName]/PageClient.module.css';
import {
  LocalUserChoices,
  RoomContext,
  LayoutContextProvider,
} from '@livekit/components-react';
import {
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
  DisconnectReason,
} from 'livekit-client';
import { useRouter } from 'next/navigation';

// V2 token is 30 min, refresh at 25 min
const TOKEN_REFRESH_INTERVAL_MS = 25 * 60 * 1000;

interface V2ConnectResponse {
  serverUrl: string;
  participantToken: string;
  participantIdentity: string;
  sessionId: string;
  livekitRoomName: string;
  isNewSession: boolean;
}

export function V2PageClient({ roomCode }: { roomCode: string }) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>();
  const [selectedLanguage, setSelectedLanguage] = React.useState('nl'); // Default to Nederlands
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = React.useState('nl');
  const [roomMetadata, setRoomMetadata] = React.useState<{
    teacherName?: string;
    language?: string;
  } | null>(null);
  const [orgSlug, setOrgSlug] = React.useState<string | null>(null);
  const [orgName, setOrgName] = React.useState<string | null>(null);
  const [connectResponse, setConnectResponse] = React.useState<V2ConnectResponse | undefined>();
  const [isConnecting, setIsConnecting] = React.useState(false);

  // Read classroom/speech mode from URL
  const [classroomInfo, setClassroomInfo] = React.useState<{
    role: string;
    pin: string | null;
    mode?: 'classroom' | 'speech';
  } | null>(null);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const isClassroom = url.searchParams.get('classroom') === 'true';
    const isSpeech = url.searchParams.get('speech') === 'true';
    const role = url.searchParams.get('role');
    const pin = url.searchParams.get('pin');

    if (isSpeech) {
      setClassroomInfo({ role: role || 'student', pin: pin || null, mode: 'speech' });
    } else {
      // Default to student when no role param is present. Teachers always
      // arrive with `role=teacher` via /v2/t/[code]; anyone else hitting
      // /v2/rooms/[code] directly is safer joining listen-only than as a
      // publishing teacher (which doubles agent STT load on live mosques).
      setClassroomInfo({ role: role || 'student', pin: pin || null, mode: 'classroom' });
    }
  }, []);

  // Read org slug from URL
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const urlOrg = url.searchParams.get('org');
    if (urlOrg) setOrgSlug(urlOrg);
  }, []);

  // Fetch classroom metadata
  React.useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const url = new URL(window.location.href);
        const urlOrg = url.searchParams.get('org');
        let apiUrl = `/api/classrooms/${roomCode}`;
        if (urlOrg) apiUrl += `?org=${encodeURIComponent(urlOrg)}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        const metadata = data.classroom
          ? { teacherName: data.classroom.name, language: data.classroom.settings?.language }
          : data.metadata || null;

        if (data.classroom?.organization_slug) setOrgSlug(data.classroom.organization_slug);
        if (data.classroom?.organization_name) setOrgName(data.classroom.organization_name);

        if (metadata) {
          setRoomMetadata(metadata);
          if (metadata.language && classroomInfo?.role === 'teacher') {
            setSelectedLanguage(metadata.language);
          }
        }
      } catch (error) {
        console.error('[V2] Failed to fetch room metadata:', error);
      }
    };
    fetchMetadata();
  }, [roomCode, classroomInfo?.role]);

  const qrCanvasRef = React.useRef<HTMLDivElement>(null);
  const copyIconRef = React.useRef<CopyIconHandle>(null);
  const downloadIconRef = React.useRef<DownloadIconHandle>(null);
  const qrCodeIconRef = React.useRef<QrCodeIconHandle>(null);

  const studentLink = React.useMemo(() => {
    if (!classroomInfo || classroomInfo.role !== 'teacher') return '';
    if (typeof window === 'undefined') return '';
    const prefix = classroomInfo.mode === 'speech' ? '/v2/speech-s/' : '/v2/s/';
    let link = `${window.location.origin}${prefix}${roomCode}`;
    const params = new URLSearchParams();
    if (orgSlug) params.set('org', orgSlug);
    if (classroomInfo.pin) params.set('pin', classroomInfo.pin);
    const qs = params.toString();
    if (qs) link += `?${qs}`;
    return link;
  }, [classroomInfo, orgSlug, roomCode]);

  const preJoinDefaults = React.useMemo(() => {
    const isStudent = classroomInfo?.role === 'student';
    const isTeacher = classroomInfo?.role === 'teacher';
    return {
      username: isTeacher && roomMetadata?.teacherName ? roomMetadata.teacherName : '',
      videoEnabled: !isStudent,
      audioEnabled: !isStudent,
    };
  }, [classroomInfo, roomMetadata]);

  // V2: Single connect call on PreJoin submit (guarded against double-click)
  const handlePreJoinSubmit = React.useCallback(
    async (values: LocalUserChoices) => {
      if (isConnecting) return; // Guard against double-submit
      setIsConnecting(true);
      setPreJoinChoices(values);

      const mode = classroomInfo?.mode || 'classroom';
      const role = classroomInfo?.role || 'student';

      try {
        const response = await fetch('/api/v2/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode,
            participantName: values.username,
            role,
            orgSlug: orgSlug || undefined,
            mode,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Connect failed (${response.status}): ${errText}`);
        }

        const data: V2ConnectResponse = await response.json();
        setConnectResponse(data);
      } catch (error) {
        console.error('[V2] Connect error:', error);
        setIsConnecting(false); // Reset on error only — allows retry
        setPreJoinChoices(undefined);
        alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [roomCode, orgSlug, classroomInfo, isConnecting],
  );

  const handlePreJoinError = React.useCallback((e: Error) => console.error(e), []);

  return (
    <main data-lk-theme="default" className={styles.mainContainer}>
      {connectResponse === undefined || preJoinChoices === undefined ? (
        <div className={styles.preJoinContainer}>
          <div className={styles.header}>
            <span className={styles.logo}>
              {orgName ? orgName.replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'bayaan.ai'}
            </span>
            <ThemeToggleButton start="top-right" />
          </div>

          <div className={styles.contentArea}>
            <div className={styles.contentWrapper}>
              {classroomInfo && (
                <div>
                  <h1 className={styles.lobbyTitle}>
                    {classroomInfo.mode === 'speech'
                      ? classroomInfo.role === 'teacher'
                        ? 'speaker lobby'
                        : 'listener lobby'
                      : classroomInfo.role === 'teacher'
                        ? 'teacher lobby'
                        : 'student lobby'}
                  </h1>

                  {classroomInfo.role === 'student' && (
                    <div className={styles.welcomeSection}>
                      <div className={styles.welcomeTitle}>Welcome!</div>
                      <div className={styles.welcomeText}>
                        Enter your name below to join the session.
                      </div>
                    </div>
                  )}

                  {classroomInfo.role === 'teacher' && (
                    <div className={styles.teacherInfo}>
                      {studentLink && (
                        <div ref={qrCanvasRef} className={styles.qrHiddenCanvas}>
                          <QRCodeCanvas value={studentLink} size={256} />
                        </div>
                      )}
                      <div className={styles.copyButtonWrapper}>
                        <StatefulButton
                          onMouseEnter={() => copyIconRef.current?.startAnimation()}
                          onMouseLeave={() => copyIconRef.current?.stopAnimation()}
                          onClick={() => {
                            copyIconRef.current?.startAnimation();
                            return new Promise((resolve) => {
                              navigator.clipboard.writeText(studentLink);
                              setTimeout(resolve, 500);
                            });
                          }}
                        >
                          <span className="inline-flex items-center gap-2">
                            <CopyIcon ref={copyIconRef} size={16} className="inline-flex" />
                            Student Link
                          </span>
                        </StatefulButton>
                        <StatefulButton
                          showStatusIndicators={false}
                          onMouseEnter={() => {
                            downloadIconRef.current?.startAnimation();
                            qrCodeIconRef.current?.startAnimation();
                          }}
                          onMouseLeave={() => {
                            downloadIconRef.current?.stopAnimation();
                            qrCodeIconRef.current?.stopAnimation();
                          }}
                          onClick={() => {
                            downloadIconRef.current?.startAnimation();
                            qrCodeIconRef.current?.startAnimation();
                            return new Promise<void>((resolve, reject) => {
                              const canvas = qrCanvasRef.current?.querySelector('canvas');
                              if (!canvas) {
                                reject(new Error('QR canvas not found'));
                                return;
                              }
                              canvas.toBlob((blob) => {
                                if (!blob) {
                                  reject(new Error('Failed to generate QR image'));
                                  return;
                                }
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${roomCode}.png`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                setTimeout(resolve, 500);
                              }, 'image/png');
                            });
                          }}
                        >
                          <span className="inline-flex items-center gap-2">
                            <DownloadIcon ref={downloadIconRef} size={16} className="inline-flex" />
                            <QrCodeIcon ref={qrCodeIconRef} size={28} />
                          </span>
                        </StatefulButton>
                      </div>
                      <div className={styles.linkDisplay}>{studentLink}</div>
                      {classroomInfo.pin && (
                        <div className={styles.pinInfo}>PIN: {classroomInfo.pin}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <CustomPreJoin
                defaults={preJoinDefaults}
                onSubmit={handlePreJoinSubmit}
                onError={handlePreJoinError}
                isConnecting={isConnecting}
                showLanguageSelector={
                  classroomInfo?.role === 'student' || classroomInfo?.role === 'teacher'
                }
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                selectedTranslationLanguage={selectedTranslationLanguage}
                onTranslationLanguageChange={setSelectedTranslationLanguage}
                isTeacher={classroomInfo?.role === 'teacher'}
                isStudent={
                  classroomInfo?.role === 'student' && classroomInfo?.mode === 'classroom'
                }
                isSpeechListener={
                  classroomInfo?.mode === 'speech' && classroomInfo?.role === 'student'
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <V2VideoConference
          connectResponse={connectResponse}
          userChoices={preJoinChoices}
          selectedLanguage={selectedLanguage}
          selectedTranslationLanguage={selectedTranslationLanguage}
          classroomRole={classroomInfo?.role}
          roomCode={roomCode}
          orgSlug={orgSlug}
          orgName={orgName}
        />
      )}
    </main>
  );
}

/**
 * V2 video conference component.
 * Key differences from v1:
 * - Uses server-provided identity (no cookie-based random postfix)
 * - Uses server-provided sessionId (UUID, passed directly to data APIs)
 * - No client session end — lifecycle is 100% webhook-driven
 * - Token refresh via /api/v2/refresh-token at 25-min intervals
 */
function V2VideoConference(props: {
  userChoices: LocalUserChoices;
  connectResponse: V2ConnectResponse;
  selectedLanguage?: string;
  selectedTranslationLanguage?: string;
  classroomRole?: string;
  roomCode: string;
  orgSlug?: string | null;
  orgName?: string | null;
}) {
  const [sessionStartTime, setSessionStartTime] = React.useState(Date.now());
  const router = useRouter();

  const isConnectingRef = React.useRef(false);
  const isReconnectingRef = React.useRef(false);

  // Store connect response in a ref so the connect useEffect doesn't re-fire on prop changes.
  // This prevents the disconnect-reconnect cycle caused by double-submit race conditions.
  const connectResponseRef = React.useRef(props.connectResponse);

  // Store latest token for reconnection (updated by token refresh timer)
  const latestTokenRef = React.useRef(props.connectResponse.participantToken);
  const serverUrlRef = React.useRef(props.connectResponse.serverUrl);

  // Keep refs in sync if props change (e.g. token refresh at parent level)
  React.useEffect(() => {
    latestTokenRef.current = props.connectResponse.participantToken;
    serverUrlRef.current = props.connectResponse.serverUrl;
  }, [props.connectResponse.participantToken, props.connectResponse.serverUrl]);

  const roomOptions = React.useMemo((): RoomOptions => {
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
      red: true,
      videoCodec: 'vp9' as VideoCodec,
    };
    return {
      videoCaptureDefaults,
      publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
    };
  }, [props.userChoices]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  const connectOptions = React.useMemo((): RoomConnectOptions => ({ autoSubscribe: true }), []);
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error('[V2]', error);
    alert(`Error: ${error.message}`);
  }, []);

  // Connect to room — uses ref for connectResponse to prevent re-firing on double-submit.
  // This effect should only run once when the component mounts.
  React.useEffect(() => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    const cr = connectResponseRef.current;

    const connectWithRetry = async (attempt = 1): Promise<void> => {
      try {
        await room.connect(cr.serverUrl, cr.participantToken, connectOptions);
      } catch (error: any) {
        if (
          (error.message?.includes('not valid yet') || error.message?.includes('nbf')) &&
          attempt < 3
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return connectWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    connectWithRetry()
      .then(async () => {
        setSessionStartTime(Date.now());
        console.log('[V2] Connected. Session:', cr.sessionId);

        // Set language attributes
        if (
          (props.classroomRole === 'student' || props.classroomRole === 'teacher') &&
          props.selectedLanguage
        ) {
          try {
            if (props.classroomRole === 'teacher') {
              const attrs: Record<string, string> = {
                speaking_language: props.selectedLanguage,
              };
              if (props.selectedTranslationLanguage) {
                attrs.captions_language = props.selectedTranslationLanguage;
              }
              await room.localParticipant.setAttributes(attrs);
            } else {
              await room.localParticipant.setAttributes({
                captions_language: props.selectedLanguage,
              });
            }
          } catch (error) {
            console.error('[V2] Failed to set language attributes:', error);
          }
        }

        // Fetch and set custom translation prompt for teachers
        if (props.classroomRole === 'teacher') {
          try {
            const promptResponse = await fetch(`/api/classrooms/${props.roomCode}/prompt`);
            const promptData = await promptResponse.json();
            if (promptData.prompt_text) {
              await room.localParticipant.setAttributes({
                translation_prompt: promptData.prompt_text,
              });
            }
          } catch (error) {
            console.error('[V2] Failed to fetch translation prompt:', error);
          }
        }

        // Enable media for non-students
        const url = new URL(window.location.href);
        const isStudent =
          (url.searchParams.get('classroom') === 'true' ||
            url.searchParams.get('speech') === 'true') &&
          url.searchParams.get('role') === 'student';

        if (!isStudent) {
          if (props.userChoices.videoEnabled) {
            room.localParticipant.setCameraEnabled(true).catch((e) => {
              console.warn('[V2] Camera enable failed:', e);
            });
          }
          if (props.userChoices.audioEnabled) {
            room.localParticipant.setMicrophoneEnabled(true).catch((e) => {
              console.warn('[V2] Mic enable failed:', e);
            });
          }
        }
      })
      .catch((error) => {
        isConnectingRef.current = false;
        handleError(error);
      });

    return () => {
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, connectOptions]);

  // Token refresh timer — every 25 minutes
  React.useEffect(() => {
    const refreshToken = async () => {
      try {
        console.log('[V2 Token Refresh] Refreshing...');
        const response = await fetch('/api/v2/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: props.roomCode,
            participantIdentity: props.connectResponse.participantIdentity,
            participantName: props.userChoices.username,
            role: props.classroomRole || 'student',
            orgSlug: props.orgSlug || undefined,
          }),
        });

        if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);
        const data = await response.json();
        latestTokenRef.current = data.participantToken;
        console.log('[V2 Token Refresh] Fresh token stored');
      } catch (error) {
        console.error('[V2 Token Refresh] Failed:', error);
      }
    };

    const interval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    props.roomCode,
    props.connectResponse.participantIdentity,
    props.userChoices.username,
    props.classroomRole,
    props.orgSlug,
  ]);

  // Disconnect handler — reconnect with fresh token, NO client session end
  React.useEffect(() => {
    if (!room) return;

    const handleDisconnected = async (reason?: DisconnectReason) => {
      console.log('[V2] Disconnected, reason:', reason);

      if (reason === DisconnectReason.CLIENT_INITIATED) {
        handleOnLeave();
        return;
      }

      if (isReconnectingRef.current) return;
      isReconnectingRef.current = true;

      try {
        // Use stored fresh token for reconnection
        console.log('[V2] Reconnecting with stored token...');
        await room.connect(serverUrlRef.current, latestTokenRef.current, connectOptions);
        console.log('[V2] Reconnected successfully');
        isReconnectingRef.current = false;
      } catch (error) {
        console.error('[V2] Reconnection failed:', error);
        isReconnectingRef.current = false;
        handleOnLeave();
      }
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room, connectOptions, handleOnLeave]);

  // Determine mode from URL
  const [isClassroom, setIsClassroom] = React.useState(false);
  const [isSpeech, setIsSpeech] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    setIsClassroom(url.searchParams.get('classroom') === 'true');
    setIsSpeech(url.searchParams.get('speech') === 'true');
    setUserRole(url.searchParams.get('role'));
  }, []);

  return (
    <div className="lk-room-container" data-lk-theme="default">
      <RoomContext.Provider value={room}>
        <LayoutContextProvider>
          <KeyboardShortcuts />
          {isClassroom ? (
            <ClassroomClientImpl
              userRole={userRole}
              roomName={props.roomCode}
              sessionStartTime={sessionStartTime}
              sessionId={props.connectResponse.sessionId}
              orgSlug={props.orgSlug}
              orgName={props.orgName}
              transcriptionApiUrl="/api/v2/transcriptions"
              translationApiUrl="/api/v2/translations"
            />
          ) : isSpeech ? (
            <SpeechClientImpl
              userRole={userRole}
              roomName={props.roomCode}
              sessionStartTime={sessionStartTime}
              sessionId={props.connectResponse.sessionId}
              orgSlug={props.orgSlug}
              orgName={props.orgName}
              transcriptionApiUrl="/api/v2/transcriptions"
              translationApiUrl="/api/v2/translations"
            />
          ) : (
            // Fallback: classroom mode by default for v2
            <ClassroomClientImpl
              userRole={userRole}
              roomName={props.roomCode}
              sessionStartTime={sessionStartTime}
              sessionId={props.connectResponse.sessionId}
              orgSlug={props.orgSlug}
              orgName={props.orgName}
              transcriptionApiUrl="/api/v2/transcriptions"
              translationApiUrl="/api/v2/translations"
            />
          )}
          <DebugMode />
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
