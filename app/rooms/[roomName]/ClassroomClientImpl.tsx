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
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { CopyStudentLinkButton } from '@/lib/CopyStudentLinkButton';
import styles from './ClassroomClient.module.css';

interface ClassroomClientImplProps {
  userRole?: string | null;
}

export function ClassroomClientImpl({ userRole }: ClassroomClientImplProps) {
  const router = useRouter();
  const room = useRoomContext(); // Get room from context instead of props
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { widget } = useLayoutContext(); // Get widget state for chat visibility

  // State for translation panel visibility and width (only for students)
  const [showTranslation, setShowTranslation] = React.useState(false);
  const [translationWidth, setTranslationWidth] = React.useState(320);
  const [isResizing, setIsResizing] = React.useState(false);
  const translationRef = React.useRef<HTMLDivElement>(null);

  // State for chat sidebar width
  const [chatWidth, setChatWidth] = React.useState(320);
  const [isResizingChat, setIsResizingChat] = React.useState(false);

  // Separate teacher and students based on metadata
  const { teacher, students } = React.useMemo(() => {
    let teacherParticipant: Participant | undefined;
    const studentParticipants: Participant[] = [];

    participants.forEach(participant => {
      // Check participant metadata for role
      const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
      const participantRole = metadata.role || (participant === localParticipant ? userRole : 'student');

      if (participantRole === 'teacher') {
        teacherParticipant = participant;
      } else {
        studentParticipants.push(participant);
      }
    });

    return {
      teacher: teacherParticipant,
      students: studentParticipants,
    };
  }, [participants, localParticipant, userRole]);

  // Get video and audio tracks for the teacher
  const teacherTracks = useTracks(
    [Track.Source.Camera, Track.Source.Microphone, Track.Source.ScreenShare],
    teacher ? { participant: teacher } : undefined
  );

  // Get tracks for students
  const studentTracks = useTracks(
    [Track.Source.Camera, Track.Source.Microphone],
    { participants: students }
  );

  const handleOnLeave = React.useCallback(() => {
    router.push('/');
  }, [router]);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
    };
  }, [room, handleOnLeave]);

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

  const isTeacher = userRole === 'teacher';

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
                <div className={styles.translationPlaceholder}>
                  <div className={styles.translationEmptyIcon}>📝</div>
                  <p className={styles.translationEmptyText}>
                    Real-time transcription and translation will appear here
                  </p>
                  <p className={styles.translationComingSoon}>
                    Feature coming soon...
                  </p>
                </div>
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

          {/* Teacher video section - large display */}
          <div className={styles.teacherSection}>
            {teacher ? (
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
            ) : (
              <div className={styles.waitingForTeacher}>
                <div className={styles.waitingIcon}>⏳</div>
                <div className={styles.waitingText}>Waiting for teacher to join...</div>
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

        {/* Students grid section - Fixed at bottom */}
        <div className={styles.studentsSection}>
          <div className={styles.sectionHeader}>
            <h3>Students ({students.length})</h3>
          </div>

          <div className={styles.studentsGrid}>
            {students.length > 0 ? (
              students.map((student) => {
                const studentTrack = studentTracks.find(
                  track => isTrackReference(track) && track.participant === student
                );

                return (
                  <div key={student.identity} className={styles.studentTile}>
                    {/* Student role badge */}
                    <div className={styles.studentBadge}>👨‍🎓</div>

                    {studentTrack && isTrackReference(studentTrack) && studentTrack.publication.kind === 'video' ? (
                      <VideoTrack
                        trackRef={studentTrack}
                        className={styles.studentVideo}
                      />
                    ) : (
                      <div className={styles.studentNoVideo}>
                        <div className={styles.studentAvatar}>👨‍🎓</div>
                      </div>
                    )}

                    <div className={styles.studentName}>
                      {student.name || 'Student'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.noStudents}>
                <p>No students have joined yet</p>
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
            microphone: isTeacher,
            camera: isTeacher,
            chat: true,
            screenShare: isTeacher,
            leave: true
          }}
        />
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
      {isTeacher && <CopyStudentLinkButton />}
      {process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' && <SettingsMenu />}
    </div>
  );
}