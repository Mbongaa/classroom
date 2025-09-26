'use client';

import React from 'react';
import {
  VideoTrack,
  AudioTrack,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
  Chat,
  ConnectionStateToast,
  TrackReference,
  useConnectionState,
  isTrackReference,
  useLayoutContext,
} from '@livekit/components-react';
import { CustomControlBar } from '@/app/components/video-conference/CustomControlBar';
import { CustomParticipantTile } from '@/app/components/video-conference/CustomParticipantTile';
import {
  Track,
  Participant,
  RoomEvent,
  DataPacket_Kind,
  ParticipantKind,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { Clipboard, Check, GripVertical } from 'lucide-react';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { AvatarWithDropdown } from '@/lib/AvatarWithDropdown';
import { StudentPermissionNotification } from '@/lib/StudentPermissionNotification';
import { TeacherRequestPanel } from '@/lib/TeacherRequestPanel';
import { HeaderRequestDropdown } from '@/lib/HeaderRequestDropdown';
import { StudentRequestDropdown } from '@/lib/StudentRequestDropdown';
import { RequestIndicator } from '@/lib/RequestIndicator';
import { QuestionBubble } from '@/lib/QuestionBubble';
import TranslationPanel from '@/app/components/TranslationPanel';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
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

  // Extract initials from participant name
  const getInitials = (name: string | undefined) => {
    if (!name || name.trim() === '') {
      return 'ST'; // Default for Student
    }

    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/).filter(part => part.length > 0);

    if (parts.length === 0) {
      return 'ST';
    }

    if (parts.length === 1) {
      // For single word names, take first two letters
      return parts[0].slice(0, 2).toUpperCase();
    }

    // For multiple word names, take first letter of first and last word
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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

  // State for copy link feedback
  const [linkCopied, setLinkCopied] = React.useState(false);

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

        // If it's my request and it was answered/declined, clear my active request
        if (myActiveRequest?.id === requestId) {
          if (status === 'approved' || status === 'declined' || status === 'answered') {
            setMyActiveRequest(null);
          }
        }

        // Clear displayed questions for ALL students when teacher resolves question
        if (status === 'answered' || status === 'declined') {
          setDisplayedQuestions(prev => {
            const newMap = new Map(prev);
            newMap.delete(requestId);
            return newMap;
          });
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

          // Questions now stay visible until teacher manually marks them as answered
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
      {/* Fixed header with room info and request dropdown */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.roomInfo}>
            <span className={styles.roomName}>bayaan.ai</span>
          </div>

          <div className={styles.headerControls}>
            {/* Theme toggle - available for all users */}
            <ThemeToggleButton />

            {/* Teacher controls */}
            {isTeacher && (<>
              {/* Copy student link button */}
              <button
                className={`${styles.copyLinkButton} ${linkCopied ? styles.copied : ''}`}
                onClick={() => {
                  const studentLink = `${window.location.origin}/s/${room.name}`;
                  navigator.clipboard.writeText(studentLink);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                title={linkCopied ? "Link copied!" : "Copy student link"}
                aria-label="Copy student link to clipboard"
              >
                {linkCopied ? <Check size={18} /> : <Clipboard size={18} />}
              </button>

              {/* Request Dropdown */}
              <HeaderRequestDropdown
                requests={requests}
                onApprove={handleApproveRequest}
                onDecline={handleDeclineRequest}
                onDisplay={handleDisplayQuestion}
                onMarkAnswered={handleMarkAnswered}
              />
            </>)}

            {/* Student controls */}
            {!isTeacher && (
              /* Student Request Dropdown */
              <StudentRequestDropdown
                activeRequest={myActiveRequest}
                onSubmit={handleRequestSubmit}
              />
            )}
          </div>
        </div>
      </div>

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
              <TranslationPanel
                captionsLanguage={captionsLanguage}
                onClose={() => setShowTranslation(false)}
                showCloseButton={true}
              />
              <div
                className={styles.resizeHandle}
                onMouseDown={handleMouseDown}
                title="Drag to resize"
              >
                <GripVertical className={styles.resizeGrip} size={24} />
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
                    {teacherTracks.length > 0 && teacherTracks.find(track => isTrackReference(track) && track.publication.kind === 'video') ? (
                      <CustomParticipantTile
                        trackRef={teacherTracks.find(track => isTrackReference(track) && track.publication.kind === 'video')}
                        className={styles.teacherTile}
                        showSpeakingIndicator={true}
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
                      {/* Request indicator */}
                      {request && (
                        <RequestIndicator
                          request={request}
                          participantName={student.name || 'Student'}
                          isTeacher={isTeacher}
                        />
                      )}

                      {/* Permission dropdown integrated in avatar for student speaker */}

                      {studentTrack ? (
                        <CustomParticipantTile
                          trackRef={studentTrack}
                          className={styles.speakerTile}
                          showSpeakingIndicator={true}
                        />
                      ) : (
                        <div className={styles.noVideoPlaceholder}>
                          <AvatarWithDropdown
                            participant={student}
                            roomName={room.name}
                            teacherToken={teacherAuthToken || ''}
                            onPermissionUpdate={handlePermissionUpdate}
                            currentRole={metadata.role || 'student_speaker'}
                            isTeacher={isTeacher}
                            getInitials={getInitials}
                          />
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
              <GripVertical className={styles.chatResizeGrip} size={24} />
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
                    {/* Request indicator */}
                    {request && (
                      <RequestIndicator
                        request={request}
                        participantName={student.name || 'Student'}
                        isTeacher={isTeacher}
                        onQuestionDisplay={handleDisplayQuestion}
                      />
                    )}

                    <div className={styles.studentNoVideo}>
                      <AvatarWithDropdown
                        participant={student}
                        roomName={room.name}
                        teacherToken={teacherAuthToken || ''}
                        onPermissionUpdate={handlePermissionUpdate}
                        currentRole={metadata.role || 'student'}
                        isTeacher={isTeacher}
                        getInitials={getInitials}
                      />
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

      {/* Control bar at the bottom with chat toggle and translation */}
      <div className={styles.controlBar}>
        <CustomControlBar
          variation="minimal"
          controls={{
            microphone: canSpeak,
            camera: canSpeak,
            chat: true,
            screenShare: isTeacher,
            leave: true,
            translation: !isTeacher
          }}
          onTranslationClick={() => setShowTranslation(!showTranslation)}
          showTranslation={showTranslation}
          isStudent={!isTeacher}
        />
      </div>



      {/* Teacher Request Panel - Removed, now using HeaderRequestDropdown */}

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