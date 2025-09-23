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
import { CopyStudentLinkButton } from '@/lib/CopyStudentLinkButton';
import { PermissionDropdownPortal } from '@/lib/PermissionDropdownPortal';
import { StudentPermissionNotification } from '@/lib/StudentPermissionNotification';
import { StudentRequestButton } from '@/lib/StudentRequestButton';
import { TeacherRequestPanel } from '@/lib/TeacherRequestPanel';
import { RequestIndicator } from '@/lib/RequestIndicator';
import { QuestionBubble } from '@/lib/QuestionBubble';
import TranslationPanel from '@/app/components/TranslationPanel';
import {
  StudentRequest,
  StudentRequestMessage,
  RequestUpdateMessage,
  RequestDisplayMessage
} from '@/lib/types/StudentRequest';
import styles from './ClassroomClient.module.css';

interface ClassroomClientImplWithRequestsProps {
  userRole?: string | null;
}

export function ClassroomClientImplWithRequests({ userRole }: ClassroomClientImplWithRequestsProps) {
  const router = useRouter();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { widget } = useLayoutContext();

  // State for translation panel visibility and width (only for students)
  const [showTranslation, setShowTranslation] = React.useState(false);
  const [translationWidth, setTranslationWidth] = React.useState(320);

  // Get the student's selected caption language from attributes
  const captionsLanguage = localParticipant.attributes?.captions_language || 'en';
  const [isResizing, setIsResizing] = React.useState(false);
  const translationRef = React.useRef<HTMLDivElement>(null);

  // State for chat sidebar width
  const [chatWidth, setChatWidth] = React.useState(320);
  const [isResizingChat, setIsResizingChat] = React.useState(false);

  // State for permission notifications
  const [permissionNotification, setPermissionNotification] = React.useState<any>(null);

  // State for student request system
  const [requests, setRequests] = React.useState<StudentRequest[]>([]);
  const [myActiveRequest, setMyActiveRequest] = React.useState<StudentRequest | null>(null);
  const [displayedQuestions, setDisplayedQuestions] = React.useState<Map<string, StudentRequest>>(new Map());

  // Determine if current user is teacher
  const isTeacher = userRole === 'teacher';

  // Determine if current user can speak based on actual permissions
  const canSpeak = isTeacher || (localParticipant?.permissions?.canPublish ?? false);

  // Separate teacher and students based on metadata
  const { teacher, allStudents, speakingStudents } = React.useMemo(() => {
    let teacherParticipant: Participant | undefined;
    const studentsList: Participant[] = [];

    participants.forEach(participant => {
      // Filter out agents
      if (
        participant.kind === ParticipantKind.Agent ||
        participant.kind === 'agent' ||
        participant.kind === 'AGENT' ||
        (participant.name && participant.name.toLowerCase().includes('agent')) ||
        (participant.identity && participant.identity.toLowerCase().includes('agent')) ||
        (participant.identity && participant.identity.toLowerCase().includes('bot'))
      ) {
        return;
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
      allStudents: studentsList,
      speakingStudents: speakingStudentsList,
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

  // Handle student request submission
  const handleRequestSubmit = React.useCallback((type: 'voice' | 'text', question?: string) => {
    const request: StudentRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentIdentity: localParticipant.identity,
      studentName: localParticipant.name || 'Student',
      type,
      question,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Update local state
    setMyActiveRequest(request);
    setRequests(prev => [...prev, request]);

    // Send request via data channel
    const message: StudentRequestMessage = {
      type: 'STUDENT_REQUEST',
      payload: request,
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [localParticipant, room]);

  // Handle teacher approving voice request
  const handleApproveRequest = React.useCallback(async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request || request.type !== 'voice') return;

    // Update request status
    setRequests(prev => prev.map(r =>
      r.id === requestId ? { ...r, status: 'approved' as const } : r
    ));

    // For voice requests, use Phase 5 permission system
    try {
      const response = await fetch('/api/update-student-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: room.name,
          studentIdentity: request.studentIdentity,
          studentName: request.studentName,
          action: 'grant',
          teacherToken: `teacher_${room.name}_${localParticipant.identity}`,
        }),
      });

      if (response.ok) {
        // Send update via data channel
        const message: RequestUpdateMessage = {
          type: 'REQUEST_UPDATE',
          payload: {
            requestId,
            status: 'approved',
          },
        };

        const encoder = new TextEncoder();
        room.localParticipant.publishData(
          encoder.encode(JSON.stringify(message)),
          DataPacket_Kind.RELIABLE
        );
      }
    } catch (error) {
      console.error('Failed to approve voice request:', error);
    }
  }, [requests, room, localParticipant]);

  // Handle teacher declining request
  const handleDeclineRequest = React.useCallback((requestId: string) => {
    // Update request status
    setRequests(prev => prev.map(r =>
      r.id === requestId ? { ...r, status: 'declined' as const } : r
    ));

    // Send update via data channel
    const message: RequestUpdateMessage = {
      type: 'REQUEST_UPDATE',
      payload: {
        requestId,
        status: 'declined',
      },
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);

  // Handle displaying text question to all
  const handleDisplayQuestion = React.useCallback((requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request || request.type !== 'text') return;

    // Update display state
    setDisplayedQuestions(prev => new Map(prev).set(requestId, request));

    // Send display message via data channel
    const message: RequestDisplayMessage = {
      type: 'REQUEST_DISPLAY',
      payload: {
        requestId,
        question: request.question || '',
        studentName: request.studentName,
        display: true,
      },
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [requests, room]);

  // Handle marking question as answered
  const handleMarkAnswered = React.useCallback((requestId: string) => {
    // Update request status
    setRequests(prev => prev.map(r =>
      r.id === requestId ? { ...r, status: 'answered' as const } : r
    ));

    // Remove from displayed questions
    setDisplayedQuestions(prev => {
      const newMap = new Map(prev);
      newMap.delete(requestId);
      return newMap;
    });

    // Send update via data channel
    const message: RequestUpdateMessage = {
      type: 'REQUEST_UPDATE',
      payload: {
        requestId,
        status: 'answered',
      },
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);

  // Handle receiving data messages
  const handleDataReceived = React.useCallback((data: Uint8Array, participant?: Participant) => {
    try {
      const decoder = new TextDecoder();
      const message = JSON.parse(decoder.decode(data));

      // Handle permission updates (existing)
      if (message.type === 'permission_update' && message.targetParticipant === localParticipant.identity) {
        setPermissionNotification({
          type: message.action,
          message: message.action === 'grant'
            ? 'Your teacher has granted you speaking permission. You can now use your microphone and camera.'
            : 'Your speaking permission has been revoked.',
        });
      }

      // Handle student requests
      if (message.type === 'STUDENT_REQUEST') {
        const request = message.payload as StudentRequest;
        setRequests(prev => {
          // Avoid duplicates
          if (prev.some(r => r.id === request.id)) return prev;
          return [...prev, request];
        });
      }

      // Handle request updates
      if (message.type === 'REQUEST_UPDATE') {
        const { requestId, status } = message.payload;
        setRequests(prev => prev.map(r =>
          r.id === requestId ? { ...r, status } : r
        ));

        // If it's my request and it was approved/declined, update my state
        if (myActiveRequest?.id === requestId) {
          if (status === 'approved' || status === 'declined' || status === 'answered') {
            setTimeout(() => setMyActiveRequest(null), 3000);
          }
        }
      }

      // Handle question display
      if (message.type === 'REQUEST_DISPLAY') {
        const { requestId, question, studentName, display } = message.payload;
        if (display) {
          const displayRequest: StudentRequest = {
            id: requestId,
            studentIdentity: '',
            studentName,
            type: 'text',
            question,
            timestamp: Date.now(),
            status: 'displayed',
          };
          setDisplayedQuestions(prev => new Map(prev).set(requestId, displayRequest));

          // Auto-hide after 30 seconds
          setTimeout(() => {
            setDisplayedQuestions(prev => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
          }, 30000);
        } else {
          setDisplayedQuestions(prev => {
            const newMap = new Map(prev);
            newMap.delete(requestId);
            return newMap;
          });
        }
      }
    } catch (error) {
      console.error('Error parsing data channel message:', error);
    }
  }, [localParticipant, myActiveRequest]);

  // Handle accepting permission grant
  const handleAcceptPermission = React.useCallback(() => {
    setPermissionNotification(null);
  }, []);

  // Handle declining permission grant
  const handleDeclinePermission = React.useCallback(() => {
    setPermissionNotification(null);
  }, []);

  // Handle dismissing notification
  const handleDismissNotification = React.useCallback(() => {
    setPermissionNotification(null);
  }, []);

  // Handle when permissions change
  const handlePermissionChanged = React.useCallback(() => {
    console.log('Permissions changed:', localParticipant?.permissions);
  }, [localParticipant]);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantPermissionsChanged, handlePermissionChanged);

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

  // Generate teacher auth token
  const teacherAuthToken = React.useMemo(() => {
    if (isTeacher && localParticipant) {
      return `teacher_${room.name}_${localParticipant.identity}`;
    }
    return null;
  }, [isTeacher, localParticipant, room.name]);

  // Get active request for a participant
  const getParticipantRequest = (participantIdentity: string) => {
    return requests.find(r =>
      r.studentIdentity === participantIdentity &&
      r.status === 'pending'
    );
  };

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
                <TranslationPanel captionsLanguage={captionsLanguage} />
              </div>
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
            {teacher || speakingStudents.length > 0 ? (
              <div className={styles.mainVideoGrid}>
                {/* Teacher video */}
                {teacher && (
                  <div className={styles.teacherVideo}>
                    <div className={styles.roleBadge}>
                      👨‍🏫 Teacher
                    </div>

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
                  const request = getParticipantRequest(student.identity);

                  return (
                    <div key={student.identity} className={styles.speakingStudentVideo}>
                      <div className={styles.roleBadge}>
                        🎤 Speaker
                      </div>

                      {/* Request indicator */}
                      {request && (
                        <RequestIndicator
                          request={request}
                          participantName={student.name || 'Student'}
                          isTeacher={isTeacher}
                        />
                      )}

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

            {/* Display question bubbles */}
            {Array.from(displayedQuestions.values()).map(question => (
              <QuestionBubble
                key={question.id}
                question={question.question || ''}
                studentName={question.studentName}
                isDisplayedToAll={true}
                position={{ x: window.innerWidth / 2 - 150, y: 100 }}
                onClose={() => handleMarkAnswered(question.id)}
              />
            ))}
          </div>

          {/* Chat sidebar */}
          <div
            className={styles.chatWrapper}
            style={{
              display: widget.state?.showChat ? '' : 'none',
              width: `${chatWidth}px`,
              position: 'relative'
            }}
          >
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
                const request = getParticipantRequest(student.identity);

                return (
                  <div
                    key={student.identity}
                    className={`${styles.studentTile} ${isSpeaking ? styles.speaking : ''}`}
                  >
                    <div className={styles.studentBadge}>
                      {isSpeaking ? '🎤' : '👨‍🎓'}
                    </div>

                    {/* Request indicator */}
                    {request && (
                      <RequestIndicator
                        request={request}
                        participantName={student.name || 'Student'}
                        isTeacher={isTeacher}
                        onQuestionDisplay={handleDisplayQuestion}
                      />
                    )}

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
            microphone: canSpeak,
            camera: canSpeak,
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

      {/* Student Request Button */}
      <StudentRequestButton
        onRequestSubmit={handleRequestSubmit}
        hasActiveRequest={!!myActiveRequest}
        isStudent={!isTeacher}
      />

      {/* Teacher Request Panel */}
      <TeacherRequestPanel
        requests={requests}
        onApprove={handleApproveRequest}
        onDecline={handleDeclineRequest}
        onDisplay={handleDisplayQuestion}
        onMarkAnswered={handleMarkAnswered}
        isTeacher={isTeacher}
      />

      {/* Additional UI elements */}
      {isTeacher && <CopyStudentLinkButton />}
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