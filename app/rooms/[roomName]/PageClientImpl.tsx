'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { CopyStudentLinkButton } from '@/lib/CopyStudentLinkButton';
import { ConnectionDetails } from '@/lib/types';
import { ClassroomClientImplWithRequests as ClassroomClientImpl } from './ClassroomClientImplWithRequests';
import PreJoinLanguageSelect from '@/app/components/PreJoinLanguageSelect';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
  LayoutContextProvider,
} from '@livekit/components-react';
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
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>('en'); // Default to English
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
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            {classroomInfo && (
              <div>
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1.5rem',
                    background: classroomInfo.role === 'teacher' ? '#4CAF50' : '#2196F3',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                  }}
                >
                  {classroomInfo.role === 'teacher'
                    ? '👨‍🏫 Joining as Teacher (Full Access)'
                    : '👨‍🎓 Joining as Student (Listen-Only Mode)'}
                </div>

                {/* Enhanced welcome message for students */}
                {classroomInfo.role === 'student' && (
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: 'rgba(33, 150, 243, 0.1)',
                      border: '1px solid rgba(33, 150, 243, 0.3)',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      📚 Welcome to the Classroom!
                    </div>
                    <div style={{ color: '#aaa', lineHeight: '1.5' }}>
                      You're joining as a student. You'll be able to:
                      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>Watch and listen to your teacher</li>
                        <li>Participate via chat</li>
                        <li>View shared screens and materials</li>
                      </ul>
                      <small style={{ opacity: 0.8 }}>
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
                      padding: '1rem',
                      background: 'rgba(76, 175, 80, 0.1)',
                      border: '1px solid rgba(76, 175, 80, 0.3)',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      🔗 Share this Link with Students:
                    </div>
                    <div
                      style={{
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        textAlign: 'center',
                        userSelect: 'all',
                        cursor: 'pointer',
                        wordBreak: 'break-all',
                      }}
                      onClick={(e) => {
                        let studentLink = `${window.location.origin}/s/${props.roomName}`;
                        if (classroomInfo.pin) {
                          studentLink += `?pin=${classroomInfo.pin}`;
                        }
                        navigator.clipboard.writeText(studentLink);
                        alert('Student link copied to clipboard!');
                      }}
                      title="Click to copy student link"
                    >
                      {`${window.location.origin}/s/${props.roomName}${classroomInfo.pin ? `?pin=${classroomInfo.pin}` : ''}`}
                    </div>
                    {classroomInfo.pin && (
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#4CAF50',
                        marginTop: '0.5rem',
                        fontWeight: 'bold'
                      }}>
                        🔒 Classroom PIN: {classroomInfo.pin}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                      Click to copy • Students will join directly as listeners
                      {classroomInfo.pin && ' • PIN included in link'}
                    </div>
                  </div>
                )}
              </div>
            )}
            <PreJoin
              defaults={preJoinDefaults}
              onSubmit={handlePreJoinSubmit}
              onError={handlePreJoinError}
            />
            {/* Language selection for students and teachers in classroom mode */}
            {(classroomInfo?.role === 'student' || classroomInfo?.role === 'teacher') && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <PreJoinLanguageSelect
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  isTeacher={classroomInfo?.role === 'teacher'}
                />
              </div>
            )}
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
              console.log(`Set ${attributeName} to:`, props.selectedLanguage);
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
            console.log('Joined as student - media publishing disabled by token permissions');
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
          {/* Conditionally render ClassroomClientImpl or VideoConference based on classroom mode */}
          {isClassroom ? (
            <ClassroomClientImpl userRole={userRole} />
          ) : (
            <VideoConference
              chatMessageFormatter={formatChatMessageLinks}
              SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
            />
          )}
          <DebugMode />
          <RecordingIndicator />
          {isClassroom && <CopyStudentLinkButton />}
        </LayoutContextProvider>
      </RoomContext.Provider>
    </div>
  );
}
