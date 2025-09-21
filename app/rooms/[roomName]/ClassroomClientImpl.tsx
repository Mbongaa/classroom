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

  // State for translation panel visibility (only for students)
  const [showTranslation, setShowTranslation] = React.useState(false);

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
    [Track.Source.Camera, Track.Source.ScreenShare],
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

  const isTeacher = userRole === 'teacher';

  return (
    <div className={styles.classroomContainer} data-lk-theme="default">
      {/* Connection state notification */}
      <ConnectionStateToast />

      {/* Main container that will have translation, video, and chat */}
      <div className={styles.mainContainer}>
        {/* Translation sidebar - only for students, toggleable from left */}
        {!isTeacher && (
          <div
            className={styles.translationSidebar}
            style={{ display: showTranslation ? 'flex' : 'none' }}
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
          </div>
        )}

        {/* Main classroom layout */}
        <div className={styles.classroomLayout}>
            {/* Teacher video section - large display */}
            <div className={styles.teacherSection}>
              {teacher ? (
                <div className={styles.teacherVideo}>
                  {/* Teacher role badge */}
                  <div className={styles.roleBadge}>
                    👨‍🏫 Teacher
                  </div>

                  {/* Render teacher video/screen share */}
                  {teacherTracks.length > 0 ? (
                    teacherTracks.map((track) => {
                      if (!isTrackReference(track)) return null;

                      return (
                        <div key={track.publication.trackSid} className={styles.teacherTrack}>
                          {track.publication.kind === 'video' ? (
                            <VideoTrack
                              trackRef={track}
                              className={styles.videoTrack}
                            />
                          ) : null}
                          {track.publication.kind === 'audio' && (
                            <AudioTrack trackRef={track} />
                          )}
                          <div className={styles.participantName}>
                            {track.participant.name || 'Teacher'}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.noVideoPlaceholder}>
                      <div className={styles.avatarPlaceholder}>👨‍🏫</div>
                      <div className={styles.participantName}>
                        {teacher.name || 'Teacher'}
                      </div>
                      <div className={styles.noVideoText}>Camera Off</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.waitingForTeacher}>
                  <div className={styles.waitingIcon}>⏳</div>
                  <div className={styles.waitingText}>Waiting for teacher to join...</div>
                </div>
              )}
            </div>

            {/* Students grid section */}
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

        {/* Chat sidebar - will be toggled by ControlBar */}
        <Chat
          className={styles.chatSidebar}
          style={{ display: widget.state?.showChat ? 'flex' : 'none' }}
        />
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