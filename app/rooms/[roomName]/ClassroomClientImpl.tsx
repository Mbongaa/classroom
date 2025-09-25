'use client';

import React from 'react';
import {
  VideoTrack,
  AudioTrack,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
  ControlBar,
  Chat,
  ConnectionStateToast,
  TrackReference,
  useConnectionState,
  isTrackReference,
  useLayoutContext,
  ParticipantTile,
} from '@livekit/components-react';
import {
  Track,
  Participant,
  RoomEvent,
  DataPacket_Kind,
  ParticipantKind,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { PermissionDropdownPortal } from '@/lib/PermissionDropdownPortal';
import { StudentPermissionNotification } from '@/lib/StudentPermissionNotification';
import { PartyStateProvider, usePartyState } from '@/hooks/usePartyState';
import LanguageSelect from '@/app/components/LanguageSelect';
import Captions from '@/app/components/Captions';
import TranslationPanel from '@/app/components/TranslationPanel';
import styles from './ClassroomClient.module.css';

interface ClassroomClientImplProps {
  userRole?: string | null;
}

// Wrapper component to provide state context
export function ClassroomClientImpl({ userRole }: ClassroomClientImplProps) {
  return (
    <PartyStateProvider>
      <ClassroomClientImplInner userRole={userRole} />
    </PartyStateProvider>
  );
}

// Inner component that uses the state context
function ClassroomClientImplInner({ userRole }: ClassroomClientImplProps) {
  const router = useRouter();
  const room = useRoomContext(); // Get room from context instead of props
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { widget } = useLayoutContext(); // Get widget state for chat visibility

  // Caption state management
  const { state, dispatch } = usePartyState();

  // State for translation panel visibility and width (only for students)
  const [showTranslation, setShowTranslation] = React.useState(false);
  const [translationWidth, setTranslationWidth] = React.useState(320);
  const [isResizing, setIsResizing] = React.useState(false);
  const translationRef = React.useRef<HTMLDivElement>(null);

  // State for chat sidebar width
  const [chatWidth, setChatWidth] = React.useState(320);
  const [isResizingChat, setIsResizingChat] = React.useState(false);

  // State for permission notifications
  const [permissionNotification, setPermissionNotification] = React.useState<any>(null);

  // Determine if current user is teacher
  const isTeacher = userRole === 'teacher';

  // Determine if current user can speak based on actual permissions
  // This will be automatically updated when permissions change
  const canSpeak = isTeacher || (localParticipant?.permissions?.canPublish ?? false);

  // Separate teacher and students based on metadata
  const { teacher, allStudents, speakingStudents } = React.useMemo(() => {
    let teacherParticipant: Participant | undefined;
    const studentsList: Participant[] = [];

    participants.forEach(participant => {
      // Debug logging to understand participant types
      console.log('Participant Debug:', {
        name: participant.name,
        identity: participant.identity,
        kind: participant.kind,
        kindType: typeof participant.kind,
        metadata: participant.metadata,
        isLocal: participant === localParticipant,
        // Log any other potentially relevant properties
        permissions: participant.permissions,
      });

      // More comprehensive agent filtering
      // Check multiple conditions to catch agent participants
      if (
        participant.kind === ParticipantKind.Agent ||
        participant.kind === 'agent' ||
        participant.kind === 'AGENT' ||
        // Also check name and identity for agent patterns
        (participant.name && participant.name.toLowerCase().includes('agent')) ||
        (participant.identity && participant.identity.toLowerCase().includes('agent')) ||
        (participant.identity && participant.identity.toLowerCase().includes('bot'))
      ) {
        console.log('Filtering out agent participant:', participant.name || participant.identity, 'kind:', participant.kind);
        return; // Skip agent participants - they shouldn't appear in the UI
      }

      // Check participant metadata for role
      const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
      const participantRole = metadata.role || (participant === localParticipant ? userRole : 'student');

      if (participantRole === 'teacher') {
        teacherParticipant = participant;
      } else {
        studentsList.push(participant);
      }
    });

    // Filter speaking students for main video area
    const speakingStudentsList = studentsList.filter(s => {
      const meta = s.metadata ? JSON.parse(s.metadata) : {};
      return meta.role === 'student_speaker';
    });

    return {
      teacher: teacherParticipant,
      allStudents: studentsList, // All students for bottom section
      speakingStudents: speakingStudentsList, // Only speaking students for main video
    };
  }, [participants, localParticipant, userRole]);

  // Get video and audio tracks for the teacher
  const teacherTracks = useTracks(
    [Track.Source.Camera, Track.Source.Microphone, Track.Source.ScreenShare],
    teacher ? { participant: teacher } : undefined
  );

  // Get tracks for all students
  const studentTracks = useTracks(
    [Track.Source.Camera, Track.Source.Microphone],
    { participants: allStudents }
  );

  const handleOnLeave = React.useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle permission update from teacher (for teachers sending updates)
  const handlePermissionUpdate = React.useCallback((participantIdentity: string, action: 'grant' | 'revoke') => {
    // Send data channel message to notify the student
    const message = {
      type: 'permission_update',
      action,
      targetParticipant: participantIdentity,
      timestamp: Date.now(),
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);

  // Handle receiving permission updates (for students)
  const handleDataReceived = React.useCallback((data: Uint8Array, participant?: Participant) => {
    try {
      const decoder = new TextDecoder();
      const message = JSON.parse(decoder.decode(data));

      if (message.type === 'permission_update' && message.targetParticipant === localParticipant.identity) {
        // Show notification to student about permission change
        // No need to fetch token or reconnect - LiveKit handles permissions automatically
        setPermissionNotification({
          type: message.action,
          message: message.action === 'grant'
            ? 'Your teacher has granted you speaking permission. You can now use your microphone and camera.'
            : 'Your speaking permission has been revoked.',
        });
      }
    } catch (error) {
      console.error('Error parsing data channel message:', error);
    }
  }, [localParticipant]);

  // Handle accepting permission grant (for students)
  const handleAcceptPermission = React.useCallback(() => {
    // No reconnection needed! Just close the notification
    // LiveKit has already updated the permissions server-side
    setPermissionNotification(null);

    // The ControlBar will automatically show/hide based on updated permissions
    // which LiveKit handles through the ParticipantPermissionChanged event
    console.log('Permission update acknowledged');
  }, []);

  // Handle declining permission grant
  const handleDeclinePermission = React.useCallback(() => {
    setPermissionNotification(null);
  }, []);

  // Handle dismissing notification
  const handleDismissNotification = React.useCallback(() => {
    setPermissionNotification(null);
  }, []);

  // Handle when permissions change (LiveKit automatically updates)
  const handlePermissionChanged = React.useCallback(() => {
    // The canSpeak variable will automatically update since it reads from localParticipant.permissions
    // This will trigger a re-render and update the ControlBar
    console.log('Permissions changed:', localParticipant?.permissions);

    // Force a re-render to update the UI
    // The ControlBar will automatically show/hide controls based on new permissions
  }, [localParticipant]);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantPermissionsChanged, handlePermissionChanged);

    // Note: Student media is disabled in PageClientImpl right after room connection
    // This ensures it's disabled before the UI renders

    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantPermissionsChanged, handlePermissionChanged);
    };
  }, [room, handleOnLeave, handleDataReceived, handlePermissionChanged]);

  // Handle translation resize functionality
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    // Constrain width between 250px and 600px
    if (newWidth >= 250 && newWidth <= 600) {
      setTranslationWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  // Handle chat resize functionality
  const handleChatMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingChat(true);
  }, []);

  const handleChatMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizingChat) return;

    const newWidth = window.innerWidth - e.clientX;
    // Constrain width between 250px and 600px
    if (newWidth >= 250 && newWidth <= 600) {
      setChatWidth(newWidth);
    }
  }, [isResizingChat]);

  const handleChatMouseUp = React.useCallback(() => {
    setIsResizingChat(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Add no-select class to body during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    if (isResizingChat) {
      document.addEventListener('mousemove', handleChatMouseMove);
      document.addEventListener('mouseup', handleChatMouseUp);
      // Add no-select class to body during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      return () => {
        document.removeEventListener('mousemove', handleChatMouseMove);
        document.removeEventListener('mouseup', handleChatMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizingChat, handleChatMouseMove, handleChatMouseUp]);

  // Generate a simple teacher authentication token for API calls
  // In production, this should be a proper JWT token from your authentication system
  const teacherAuthToken = React.useMemo(() => {
    if (isTeacher && localParticipant) {
      // For now, we'll use a placeholder token that includes the room name and teacher identity
      // The API endpoint will need to be updated to handle this appropriately
      return `teacher_${room.name}_${localParticipant.identity}`;
    }
    return null;
  }, [isTeacher, localParticipant, room.name]);

  return (
    <div className={styles.classroomContainer} data-lk-theme="default">
      {/* Connection state notification */}
      <ConnectionStateToast />

      {/* Main container with column layout */}
      <div className={styles.mainContainer}>
        {/* Video area - contains teacher video and sidebars */}
        <div className={styles.videoArea}>
          {/* Translation sidebar - only for students, toggleable from left */}
          {!isTeacher && (
            <div
              ref={translationRef}
              className={styles.translationSidebar}
              style={{
                display: showTranslation ? 'flex' : 'none',
                width: `${translationWidth}px`
              }}
            >
              <div className={styles.translationHeader}>
                <h3 className={styles.translationTitle}>🌐 Live Translation</h3>
                <button
                  className={styles.translationCloseButton}
                  onClick={() => setShowTranslation(false)}
                  aria-label="Close translation"
                >
                  ×
                </button>
              </div>
              <div className={styles.translationContent}>
                <TranslationPanel captionsLanguage={state.captionsLanguage} />
              </div>
              {/* Resize handle at bottom-right corner */}
              <div
                className={styles.resizeHandle}
                onMouseDown={handleMouseDown}
                title="Drag to resize"
              >
                <div className={styles.resizeGrip} />
              </div>
            </div>
          )}

          {/* Main video section - Teacher and speaking students grid */}
          <div className={styles.mainVideoSection}>
            {/* Captions overlay - positioned absolutely over video */}
            <Captions
              captionsEnabled={state.captionsEnabled}
              captionsLanguage={state.captionsLanguage}
            />

            {teacher || speakingStudents.length > 0 ? (
              <div className={styles.mainVideoGrid}>
                {/* Teacher video */}
                {teacher && (
                  <div className={styles.teacherVideo}>
                    {/* Teacher role badge */}
                    <div className={styles.roleBadge}>
                      👨‍🏫 Teacher
                    </div>

                    {/* Use ParticipantTile for automatic speaking indicator */}
                    {teacherTracks.length > 0 && teacherTracks.find(track => isTrackReference(track) && track.publication.kind === 'video') ? (
                      <ParticipantTile
                        trackRef={teacherTracks.find(track => isTrackReference(track) && track.publication.kind === 'video')}
                        className={styles.teacherTile}
                        disableSpeakingIndicator={false}
                      />
                    ) : (
                      <div className={styles.noVideoPlaceholder}>
                        <div className={styles.avatarPlaceholder}>👨‍🏫</div>
                        <div className={styles.participantName}>
                          {teacher.name || 'Teacher'}
                        </div>
                        <div className={styles.noVideoText}>Camera Off</div>
                      </div>
                    )}

                    {/* Render audio tracks invisibly for proper audio playback */}
                    {teacherTracks
                      .filter(track => isTrackReference(track) && track.publication.kind === 'audio')
                      .map((track) => (
                        <AudioTrack key={track.publication.trackSid} trackRef={track} />
                      ))}
                  </div>
                )}

                {/* Speaking students videos */}
                {speakingStudents.map((student) => {
                  const studentTrack = studentTracks.find(
                    track => isTrackReference(track) &&
                    track.participant === student &&
                    track.publication.kind === 'video'
                  );
                  const audioTrack = studentTracks.find(
                    track => isTrackReference(track) &&
                    track.participant === student &&
                    track.publication.kind === 'audio'
                  );

                  const metadata = student.metadata ? JSON.parse(student.metadata) : {};

                  return (
                    <div key={student.identity} className={styles.speakingStudentVideo}>
                      {/* Speaking student badge */}
                      <div className={styles.roleBadge}>
                        🎤 Speaker
                      </div>

                      {/* Permission dropdown for teachers */}
                      {isTeacher && teacherAuthToken && (
                        <PermissionDropdownPortal
                          participant={student}
                          roomName={room.name}
                          teacherToken={teacherAuthToken}
                          onPermissionUpdate={handlePermissionUpdate}
                          currentRole={metadata.role || 'student_speaker'}
                        />
                      )}

                      {/* Video or placeholder */}
                      {studentTrack ? (
                        <ParticipantTile
                          trackRef={studentTrack}
                          className={styles.speakerTile}
                          disableSpeakingIndicator={false}
                        />
                      ) : (
                        <div className={styles.noVideoPlaceholder}>
                          <div className={styles.avatarPlaceholder}>🎤</div>
                          <div className={styles.participantName}>
                            {student.name || 'Student'}
                          </div>
                          <div className={styles.noVideoText}>Camera Off</div>
                        </div>
                      )}

                      {/* Audio track */}
                      {audioTrack && (
                        <AudioTrack trackRef={audioTrack} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.waitingForTeacher}>
                <div className={styles.waitingIcon}>⏳</div>
                <div className={styles.waitingText}>Waiting for participants...</div>
              </div>
            )}
          </div>

          {/* Chat sidebar - wrapped for resize but no forced layout */}
          <div
            className={styles.chatWrapper}
            style={{
              display: widget.state?.showChat ? '' : 'none',
              width: `${chatWidth}px`,
              position: 'relative'
            }}
          >
            {/* Resize handle on the left edge */}
            <div
              className={styles.chatResizeHandle}
              onMouseDown={handleChatMouseDown}
              title="Drag to resize"
            >
              <div className={styles.chatResizeGrip} />
            </div>
            <Chat className={styles.chatSidebar} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* All Students section - Fixed at bottom */}
        <div className={styles.studentsSection}>
          <div className={styles.sectionHeader}>
            <h3>All Students ({allStudents.length})</h3>
          </div>

          <div className={styles.studentsGrid}>
            {allStudents.length > 0 ? (
              allStudents.map((student) => {
                const metadata = student.metadata ? JSON.parse(student.metadata) : {};
                const isSpeaking = metadata.role === 'student_speaker';

                return (
                  <div
                    key={student.identity}
                    className={`${styles.studentTile} ${isSpeaking ? styles.speaking : ''}`}
                  >
                    {/* Student badge - microphone for speakers, student for listeners */}
                    <div className={styles.studentBadge}>
                      {isSpeaking ? '🎤' : '👨‍🎓'}
                    </div>

                    {/* Permission dropdown for teachers */}
                    {isTeacher && teacherAuthToken && (
                      <PermissionDropdownPortal
                        participant={student}
                        roomName={room.name}
                        teacherToken={teacherAuthToken}
                        onPermissionUpdate={handlePermissionUpdate}
                        currentRole={metadata.role || 'student'}
                      />
                    )}

                    {/* Student avatar */}
                    <div className={styles.studentNoVideo}>
                      <div className={styles.studentAvatar}>
                        {isSpeaking ? '🎤' : '👨‍🎓'}
                      </div>
                    </div>

                    <div className={styles.studentName}>
                      {student.name || 'Student'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.noStudents}>
                <p>No students in the classroom</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control bar at the bottom with chat toggle */}
      <div className={styles.controlBar}>
        <ControlBar
          variation="minimal"
          controls={{
            microphone: canSpeak, // Only show if teacher or speaking student
            camera: canSpeak, // Only show if teacher or speaking student
            chat: true,
            screenShare: isTeacher,
            leave: true
          }}
        />

        {/* Caption controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '10px' }}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CAPTIONS' })}
            className={styles.captionToggleButton}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: state.captionsEnabled ? '#4CAF50' : '#f0f0f0',
              color: state.captionsEnabled ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {state.captionsEnabled ? '📝 Captions ON' : '📝 Captions OFF'}
          </button>

          <LanguageSelect
            captionsLanguage={state.captionsLanguage}
            captionsEnabled={state.captionsEnabled}
            onLanguageChange={(lang) => dispatch({ type: 'SET_CAPTIONS_LANGUAGE', payload: lang })}
          />
        </div>
      </div>

      {/* Translation toggle button - floating button for students */}
      {!isTeacher && (
        <button
          className={styles.translationToggleButton}
          onClick={() => setShowTranslation(!showTranslation)}
          aria-pressed={showTranslation ? 'true' : 'false'}
          aria-label="Toggle translation panel"
        >
          🌐
        </button>
      )}

      {/* Additional UI elements */}
      {process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' && <SettingsMenu />}

      {/* Permission notification for students */}
      {!isTeacher && (
        <StudentPermissionNotification
          notification={permissionNotification}
          room={room}
          onAccept={handleAcceptPermission}
          onDecline={handleDeclinePermission}
          onDismiss={handleDismissNotification}
        />
      )}
    </div>
  );
}