'use client';

import React from 'react';
import { decodePassphrase, generateSessionId } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { ClassroomClientImplWithRequests as ClassroomClientImpl } from './ClassroomClientImplWithRequests';
import { SpeechClientImplWithRequests as SpeechClientImpl } from './SpeechClientImplWithRequests';
import CustomPreJoin from '@/app/components/custom-prejoin/CustomPreJoin';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
import styles from './PageClient.module.css';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  LayoutContextProvider,
} from '@livekit/components-react';
import { CustomVideoConference } from '@/app/components/video-conference/CustomVideoConference';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>(''); // Start with no selection
  const [roomMetadata, setRoomMetadata] = React.useState<{
    teacherName?: string;
    language?: string;
  } | null>(null);
  const [pinVerified, setPinVerified] = React.useState(false);
  const [enteredPin, setEnteredPin] = React.useState('');
  const [roomPin, setRoomPin] = React.useState<string | null>(null);
  const [checkingPin, setCheckingPin] = React.useState(false);

  // Check classroom/speech role from URL (client-side only to avoid hydration issues)
  const [classroomInfo, setClassroomInfo] = React.useState<{
    role: string;
    pin: string | null;
    mode?: 'classroom' | 'speech';
  } | null>(null);

  React.useEffect(() => {
    // Only access window on client side
    const currentUrl = new URL(window.location.href);
    const isClassroom = currentUrl.searchParams.get('classroom') === 'true';
    const isSpeech = currentUrl.searchParams.get('speech') === 'true';
    const role = currentUrl.searchParams.get('role');
    const pin = currentUrl.searchParams.get('pin');

    if (isClassroom) {
      setClassroomInfo({ role: role || 'student', pin: pin || null, mode: 'classroom' });
    } else if (isSpeech) {
      setClassroomInfo({ role: role || 'student', pin: pin || null, mode: 'speech' });
    }
  }, []);

  // Fetch classroom metadata to auto-populate language and teacher name (TEACHERS ONLY)
  React.useEffect(() => {
    const fetchRoomMetadata = async () => {
      try {
        const response = await fetch(`/api/classrooms/${props.roomName}`);
        const data = await response.json();

        // Handle both new classroom structure and legacy metadata structure
        const metadata = data.classroom
          ? {
              teacherName: data.classroom.name,
              language: data.classroom.settings?.language,
            }
          : data.metadata || null;

        if (metadata) {
          // Store metadata for use in preJoinDefaults
          setRoomMetadata(metadata);

          // Auto-populate language ONLY for teachers
          if (metadata.language && classroomInfo?.role === 'teacher') {
            setSelectedLanguage(metadata.language);
          }
        }
      } catch (error) {
        console.error('Failed to fetch room metadata:', error);
        // Silently fail - not critical for room functionality
      }
    };

    fetchRoomMetadata();
  }, [props.roomName, classroomInfo?.role]);

  const preJoinDefaults = React.useMemo(() => {
    // For students, disable camera/mic by default to avoid permission issues
    const isStudent = classroomInfo?.role === 'student';
    const isTeacher = classroomInfo?.role === 'teacher';

    return {
      username: isTeacher && roomMetadata?.teacherName ? roomMetadata.teacherName : '',
      videoEnabled: !isStudent, // Disabled for students
      audioEnabled: !isStudent, // Disabled for students
    };
  }, [classroomInfo, roomMetadata]);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(
    async (values: LocalUserChoices) => {
      setPreJoinChoices(values);
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomName', props.roomName);
      url.searchParams.append('participantName', values.username);
      if (props.region) {
        url.searchParams.append('region', props.region);
      }

      // Check if we have classroom or speech parameters in the current URL
      const currentUrl = new URL(window.location.href);
      const isClassroom = currentUrl.searchParams.get('classroom');
      const isSpeech = currentUrl.searchParams.get('speech');
      const role = currentUrl.searchParams.get('role');

      if (isClassroom) {
        url.searchParams.append('classroom', isClassroom);
      }
      if (isSpeech) {
        url.searchParams.append('speech', isSpeech);
      }
      if (role) {
        url.searchParams.append('role', role);
      }

      const connectionDetailsResp = await fetch(url.toString());
      const connectionDetailsData = await connectionDetailsResp.json();
      setConnectionDetails(connectionDetailsData);
    },
    [props.roomName, props.region],
  );
  const handlePreJoinError = React.useCallback((e: Error) => console.error(e), []);

  return (
    <main data-lk-theme="default" className={styles.mainContainer}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div className={styles.preJoinContainer}>
          {/* Header with Bayaan logo - placed outside the centered content */}
          <div className={styles.header}>
            <span className={styles.logo}>bayaan.ai</span>
            <ThemeToggleButton start="top-right" />
          </div>

          {/* Main content area */}
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

                  {/* Enhanced welcome message for students */}
                  {classroomInfo.role === 'student' && (
                    <div className={styles.welcomeSection}>
                      <div className={styles.welcomeTitle}>📚 Welcome to the Classroom!</div>
                      <div className={styles.welcomeText}>
                        You&apos;re joining as a student. You&apos;ll be able to:
                        <ul className={styles.welcomeList}>
                          <li>Watch and listen to your teacher</li>
                          <li>Participate via chat</li>
                          <li>View shared screens and materials</li>
                        </ul>
                        <small className={styles.welcomeNote}>
                          Just enter your name below to join the session.
                        </small>
                      </div>
                    </div>
                  )}

                  {/* Show shareable link for teachers */}
                  {classroomInfo.role === 'teacher' && (
                    <div className={styles.teacherInfo}>
                      {/* Stateful Copy Button */}
                      <div className={styles.copyButtonWrapper}>
                        <StatefulButton
                          onClick={() => {
                            return new Promise((resolve) => {
                              const prefix = classroomInfo.mode === 'speech' ? '/speech-s/' : '/s/';
                              let studentLink = `${window.location.origin}${prefix}${props.roomName}`;
                              if (classroomInfo.pin) {
                                studentLink += `?pin=${classroomInfo.pin}`;
                              }
                              navigator.clipboard.writeText(studentLink);
                              setTimeout(resolve, 500); // Short delay to show animation
                            });
                          }}
                        >
                          Copy Student Link
                        </StatefulButton>
                      </div>

                      {/* Show the link for reference */}
                      <div className={styles.linkDisplay}>
                        {`${window.location.origin}${classroomInfo.mode === 'speech' ? '/speech-s/' : '/s/'}${props.roomName}${classroomInfo.pin ? `?pin=${classroomInfo.pin}` : ''}`}
                      </div>

                      {classroomInfo.pin && (
                        <div className={styles.pinInfo}>🔒 Classroom PIN: {classroomInfo.pin}</div>
                      )}
                      <div className={styles.infoNote}>
                        Students will join directly as listeners
                        {classroomInfo.pin && ' • PIN included in link'}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <CustomPreJoin
                defaults={preJoinDefaults}
                onSubmit={handlePreJoinSubmit}
                onError={handlePreJoinError}
                showLanguageSelector={
                  classroomInfo?.role === 'student' || classroomInfo?.role === 'teacher'
                }
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
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
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          selectedLanguage={selectedLanguage}
          classroomRole={classroomInfo?.role}
          roomName={props.roomName}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  selectedLanguage?: string;
  classroomRole?: string;
  roomName: string;
}) {
  const keyProvider = React.useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);
  const [sessionStartTime, setSessionStartTime] = React.useState<number>(Date.now());
  const [sessionId, setSessionId] = React.useState<string>('');

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec, e2eeEnabled, keyProvider, worker]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase, keyProvider]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .then(async () => {
          // Set participant language attribute FIRST for students and teachers in classroom mode
          // This ensures TranscriptionSaver sees the correct language when it mounts
          if (
            (props.classroomRole === 'student' || props.classroomRole === 'teacher') &&
            props.selectedLanguage
          ) {
            try {
              // Use different attribute names for teachers and students
              const attributeName =
                props.classroomRole === 'teacher' ? 'speaking_language' : 'captions_language';

              // Debug logging to trace language code
              console.log('[DEBUG] Setting language attribute:', {
                role: props.classroomRole,
                attributeName: attributeName,
                language: props.selectedLanguage,
                languageType: typeof props.selectedLanguage,
                languageLength: props.selectedLanguage?.length,
                languageBytes: props.selectedLanguage
                  ? Array.from(props.selectedLanguage).map((c) => c.charCodeAt(0))
                  : [],
              });

              await room.localParticipant.setAttributes({
                [attributeName]: props.selectedLanguage,
              });

              console.log('[DEBUG] Language attribute set successfully');
            } catch (error) {
              console.error('[DEBUG] Failed to set language attribute:', error);
            }
          }

          // Initialize session for transcript saving AFTER language is set
          try {
            // CRITICAL: Wait for the real LiveKit room SID
            // This is the unique identifier for this specific room instance
            const realRoomSid = await room.getSid();
            console.log('[Session Create] Got real LiveKit room SID:', realRoomSid);

            const participantName =
              room.localParticipant?.identity ||
              room.localParticipant?.name ||
              props.userChoices.username;
            console.log(
              '[Session Create] Creating/joining session for room:',
              room.name,
              'roomSid:',
              realRoomSid,
              'participant:',
              participantName,
            );

            // Generate session ID only once and store in state
            let sessionIdValue = sessionId;
            if (!sessionIdValue) {
              sessionIdValue = generateSessionId(props.roomName);
              setSessionId(sessionIdValue);
              console.log('[Session Create] Generated new sessionId:', sessionIdValue);
            }

            const response = await fetch('/api/sessions/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomName: props.roomName,
                roomSid: realRoomSid, // Use the actual LiveKit room SID
                sessionId: sessionIdValue,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              // IMPORTANT: Use the session_id from the database
              // This ensures all participants use the same session_id
              if (data.existed) {
                // Session already existed - use its session_id
                setSessionId(data.session.session_id);
                console.log(
                  '[Session Create] Joined existing session:',
                  data.session.session_id,
                  'for room_sid:',
                  realRoomSid,
                );
              } else {
                // New session was created with our generated session_id
                console.log(
                  '[Session Create] Created new session:',
                  data.session.session_id,
                  'for room_sid:',
                  realRoomSid,
                );
              }
              // Set the session start time for child components
              setSessionStartTime(Date.now());
            } else {
              console.error('[Session Create] Failed to create session:', await response.text());
              // Still set start time even if session creation fails (allows local operation)
              setSessionStartTime(Date.now());
            }
          } catch (error) {
            console.error('[Session Create] Error creating session:', error);
            // Still set start time even if session creation fails (allows local operation)
            setSessionStartTime(Date.now());
          }

          // Check if user is a student by parsing the token or checking URL
          const currentUrl = new URL(window.location.href);
          const isClassroom = currentUrl.searchParams.get('classroom') === 'true';
          const isSpeech = currentUrl.searchParams.get('speech') === 'true';
          const role = currentUrl.searchParams.get('role');
          const isStudent = (isClassroom || isSpeech) && role === 'student';

          // Only enable media for non-students or if explicitly chosen
          if (!isStudent) {
            if (props.userChoices.videoEnabled) {
              room.localParticipant.setCameraEnabled(true).catch((error) => {
                console.warn('Failed to enable camera:', error);
                // Only show error if it's not a permission issue
                if (!error.message?.includes('permission')) {
                  handleError(error);
                }
              });
            }
            if (props.userChoices.audioEnabled) {
              room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
                console.warn('Failed to enable microphone:', error);
                // Only show error if it's not a permission issue
                if (!error.message?.includes('permission')) {
                  handleError(error);
                }
              });
            }
          } else {
            // Students have canPublish: false in their token, so no need to disable
          }
        })
        .catch((error) => {
          handleError(error);
        });
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [
    e2eeSetupComplete,
    room,
    props.connectionDetails,
    props.userChoices,
    setSessionId,
    connectOptions,
    handleEncryptionError,
    handleError,
    handleOnLeave,
    props.classroomRole,
    props.roomName,
    props.selectedLanguage,
    sessionId,
  ]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Check if we're in classroom or speech mode (client-side only)
  // Use lazy initialization to read URL params BEFORE first render
  const [isClassroom, setIsClassroom] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    return url.searchParams.get('classroom') === 'true';
  });

  const [isSpeech, setIsSpeech] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    return url.searchParams.get('speech') === 'true';
  });

  const [userRole, setUserRole] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    return url.searchParams.get('role');
  });

  return (
    <div className="lk-room-container" data-lk-theme="default">
      <RoomContext.Provider value={room}>
        <LayoutContextProvider>
          <KeyboardShortcuts />
          {/* Conditionally render ClassroomClientImpl, SpeechClientImpl, or CustomVideoConference based on mode */}
          {isClassroom ? (
            <ClassroomClientImpl
              userRole={userRole}
              roomName={props.roomName}
              sessionStartTime={sessionStartTime}
              sessionId={sessionId}
            />
          ) : isSpeech ? (
            <SpeechClientImpl
              userRole={userRole}
              roomName={props.roomName}
              sessionStartTime={sessionStartTime}
              sessionId={sessionId}
            />
          ) : (
            <CustomVideoConference
              chatMessageFormatter={formatChatMessageLinks}
              SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
              showLayoutSwitcher={true}
              defaultLayout="grid"
            />
          )}
          <DebugMode />
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
