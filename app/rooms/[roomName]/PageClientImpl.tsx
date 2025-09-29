'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { ClassroomClientImplWithRequests as ClassroomClientImpl } from './ClassroomClientImplWithRequests';
import CustomPreJoin from '@/app/components/custom-prejoin/CustomPreJoin';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
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
  const [pinVerified, setPinVerified] = React.useState(false);
  const [enteredPin, setEnteredPin] = React.useState('');
  const [roomPin, setRoomPin] = React.useState<string | null>(null);
  const [checkingPin, setCheckingPin] = React.useState(false);

  // Check classroom role from URL (client-side only to avoid hydration issues)
  const [classroomInfo, setClassroomInfo] = React.useState<{ role: string; pin: string | null } | null>(null);

  React.useEffect(() => {
    // Only access window on client side
    const currentUrl = new URL(window.location.href);
    const isClassroom = currentUrl.searchParams.get('classroom') === 'true';
    const role = currentUrl.searchParams.get('role');
    const pin = currentUrl.searchParams.get('pin');

    if (isClassroom) {
      setClassroomInfo({ role: role || 'student', pin: pin || null });
    }
  }, []);

  const preJoinDefaults = React.useMemo(() => {
    // For students, disable camera/mic by default to avoid permission issues
    const isStudent = classroomInfo?.role === 'student';

    return {
      username: '',
      videoEnabled: !isStudent, // Disabled for students
      audioEnabled: !isStudent, // Disabled for students
    };
  }, [classroomInfo]);
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

      // Check if we have classroom parameters in the current URL
      const currentUrl = new URL(window.location.href);
      const isClassroom = currentUrl.searchParams.get('classroom');
      const role = currentUrl.searchParams.get('role');

      if (isClassroom) {
        url.searchParams.append('classroom', isClassroom);
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
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header with Bayaan logo - placed outside the centered content */}
          <div style={{
            height: '56px',
            background: 'var(--lk-bg, #000000)',
            borderBottom: '1px solid rgba(128, 128, 128, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--foreground)',
              letterSpacing: '-0.03rem'
            }}>
              bayaan.ai
            </span>
            <ThemeToggleButton start="top-right" />
          </div>

          {/* Main content area */}
          <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
            <div style={{
              textAlign: 'center',
              width: 'min(100%, 480px)',
              marginInline: 'auto'
            }}>
            {classroomInfo && (
              <div>
                <h1
                  style={{
                    marginBottom: '1.5rem',
                    padding: '0.75rem 0.5rem',
                    background: 'transparent',
                    color: 'var(--lk-text1, white)',
                    borderRadius: '8px',
                    fontSize: '3.5rem',
                    fontWeight: '700',
                    fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                    textAlign: 'center',
                    textTransform: 'none',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {classroomInfo.role === 'teacher'
                    ? 'teacher lobby'
                    : 'student lobby'}
                </h1>

                {/* Enhanced welcome message for students */}
                {classroomInfo.role === 'student' && (
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--lk-text1, white)' }}>
                      📚 Welcome to the Classroom!
                    </div>
                    <div style={{ color: 'var(--lk-text2, #aaa)', lineHeight: '1.5' }}>
                      You&apos;re joining as a student. You&apos;ll be able to:
                      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>Watch and listen to your teacher</li>
                        <li>Participate via chat</li>
                        <li>View shared screens and materials</li>
                      </ul>
                      <small style={{ opacity: 0.8, color: 'var(--lk-text2, #aaa)' }}>
                        Just enter your name below to join the session.
                      </small>
                    </div>
                  </div>
                )}

                {/* Show shareable link for teachers */}
                {classroomInfo.role === 'teacher' && (
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      fontSize: '0.95rem',
                    }}
                  >
                    {/* Stateful Copy Button */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                      <StatefulButton
                        onClick={() => {
                          return new Promise((resolve) => {
                            let studentLink = `${window.location.origin}/s/${props.roomName}`;
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
                    <div
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        wordBreak: 'break-all',
                        color: 'var(--lk-text2, #888)',
                      }}
                    >
                      {`${window.location.origin}/s/${props.roomName}${classroomInfo.pin ? `?pin=${classroomInfo.pin}` : ''}`}
                    </div>

                    {classroomInfo.pin && (
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#4CAF50',
                        marginTop: '0.5rem',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        🔒 Classroom PIN: {classroomInfo.pin}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem', textAlign: 'center' }}>
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
              showLanguageSelector={classroomInfo?.role === 'student' || classroomInfo?.role === 'teacher'}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              isTeacher={classroomInfo?.role === 'teacher'}
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
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

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
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

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
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
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
          // Set participant language attribute for students and teachers in classroom mode
          if ((props.classroomRole === 'student' || props.classroomRole === 'teacher') && props.selectedLanguage) {
            try {
              // Use different attribute names for teachers and students
              const attributeName = props.classroomRole === 'teacher' ? 'speaking_language' : 'captions_language';
              await room.localParticipant.setAttributes({
                [attributeName]: props.selectedLanguage,
              });
            } catch (error) {
              console.error('Failed to set language attribute:', error);
            }
          }

          // Check if user is a student by parsing the token or checking URL
          const currentUrl = new URL(window.location.href);
          const isClassroom = currentUrl.searchParams.get('classroom') === 'true';
          const role = currentUrl.searchParams.get('role');
          const isStudent = isClassroom && role === 'student';

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
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const lowPowerMode = useLowCPUOptimizer(room);

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
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // Check if we're in classroom mode (client-side only)
  const [isClassroom, setIsClassroom] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Only access window on client side
    const currentUrl = new URL(window.location.href);
    const classroomParam = currentUrl.searchParams.get('classroom') === 'true';
    const roleParam = currentUrl.searchParams.get('role');

    setIsClassroom(classroomParam);
    setUserRole(roleParam);
  }, []);

  return (
    <div className="lk-room-container" data-lk-theme="default">
      <RoomContext.Provider value={room}>
        <LayoutContextProvider>
          <KeyboardShortcuts />
          {/* Conditionally render ClassroomClientImpl or CustomVideoConference based on classroom mode */}
          {isClassroom ? (
            <ClassroomClientImpl userRole={userRole} />
          ) : (
            <CustomVideoConference
              chatMessageFormatter={formatChatMessageLinks}
              SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
              showLayoutSwitcher={true}
              defaultLayout="grid"
            />
          )}
          <DebugMode />
          <RecordingIndicator />
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
