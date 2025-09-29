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
import CustomParticipantTile from '@/app/components/video-conference/CustomParticipantTile';
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
import AvatarWithDropdown from '@/lib/AvatarWithDropdown';
import { QuestionBubble } from '@/lib/QuestionBubble';
import SpeechTranslationPanel from '@/app/components/SpeechTranslationPanel';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import {
  StudentRequest,
  StudentRequestMessage,
  RequestUpdateMessage,
  RequestDisplayMessage
} from '@/lib/types/StudentRequest';
import { useResizable } from '@/lib/useResizable';
import { isAgentParticipant } from '@/lib/participantUtils';
import { parseParticipantMetadata, getParticipantRole } from '@/lib/metadataUtils';
import styles from './SpeechClient.module.css';

interface PermissionNotification {
  type: 'grant' | 'revoke';
  message: string;
}

interface SpeechClientImplWithRequestsProps {
  userRole?: string | null;
}

export function SpeechClientImplWithRequests({ userRole }: SpeechClientImplWithRequestsProps) {
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
  const [showTranslation, setShowTranslation] = React.useState(userRole !== 'teacher');
  // Calculate 70% of viewport width for max translation panel width
  const [maxTranslationWidth, setMaxTranslationWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth * 0.7 : 800
  );

  const translationResize = useResizable({
    initialWidth: 320,
    minWidth: 250,
    maxWidth: maxTranslationWidth,
  });

  // Get the student's selected caption language from attributes
  const captionsLanguage = localParticipant.attributes?.captions_language || 'en';
  const translationRef = React.useRef<HTMLDivElement>(null);

  // State for chat sidebar width
  const chatResize = useResizable({
    initialWidth: 320,
    minWidth: 250,
    maxWidth: 600,
    widthCalculation: (clientX: number) => window.innerWidth - clientX, // Right-edge resize
  });

  // State for permission notifications
  const [permissionNotification, setPermissionNotification] = React.useState<PermissionNotification | null>(null);

  // State for student request system
  const [requests, setRequests] = React.useState<StudentRequest[]>([]);
  const [myActiveRequest, setMyActiveRequest] = React.useState<StudentRequest | null>(null);
  const [displayedQuestions, setDisplayedQuestions] = React.useState<Map<string, StudentRequest>>(new Map());

  // State for copy link feedback
  const [linkCopied, setLinkCopied] = React.useState(false);

  // State for mobile detection
  const [isMobile, setIsMobile] = React.useState(false);

  // Determine if current user is teacher
  const isTeacher = userRole === 'teacher';

  // Determine if current user can speak based on actual permissions
  const canSpeak = isTeacher || (localParticipant?.permissions?.canPublish ?? false);

  // Separate teacher and students based on metadata (optimized)
  const { teacher, allStudents, speakingStudents } = React.useMemo(() => {
    let teacherParticipant: Participant | undefined;
    const studentsList: Participant[] = [];
    const speakingStudentsList: Participant[] = [];

    // Single pass through participants with optimized metadata parsing
    participants.forEach(participant => {
      // Filter out agents
      if (isAgentParticipant(participant)) {
        return;
      }

      // Parse metadata safely once per participant
      const participantRole = getParticipantRole(participant, localParticipant, userRole);

      if (participantRole === 'teacher') {
        teacherParticipant = participant;
      } else {
        studentsList.push(participant);
        // Check if speaking student in same loop
        if (participantRole === 'student_speaker') {
          speakingStudentsList.push(participant);
        }
      }
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

  // Separate screen share tracks from camera tracks for the teacher
  const teacherScreenShareTrack = teacherTracks.find(
    track => isTrackReference(track) && track.source === Track.Source.ScreenShare
  );

  const teacherCameraTrack = teacherTracks.find(
    track => isTrackReference(track) && track.source === Track.Source.Camera
  );

  const teacherAudioTracks = teacherTracks.filter(
    track => isTrackReference(track) && track.publication.kind === 'audio'
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

  // Handle teacher approving voice request (optimized dependencies)
  const handleApproveRequest = React.useCallback(async (requestId: string) => {
    // Use functional update to avoid dependency on requests array
    let targetRequest: StudentRequest | undefined;
    setRequests(prev => {
      targetRequest = prev.find(r => r.id === requestId);
      if (!targetRequest || targetRequest.type !== 'voice') return prev;
      return prev.map(r => r.id === requestId ? { ...r, status: 'approved' as const } : r);
    });

    if (!targetRequest || targetRequest.type !== 'voice') return;

    // For voice requests, use Phase 5 permission system
    try {
      const response = await fetch('/api/update-speech-student-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: room.name,
          studentIdentity: targetRequest.studentIdentity,
          studentName: targetRequest.studentName,
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
  }, [room, localParticipant]);

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

  // Handle displaying text question to all (optimized dependencies)
  const handleDisplayQuestion = React.useCallback((requestId: string) => {
    // Use functional update to find request without depending on requests array
    let targetRequest: StudentRequest | undefined;
    setRequests(prev => {
      targetRequest = prev.find(r => r.id === requestId);
      return prev; // No state change needed here
    });

    if (!targetRequest || targetRequest.type !== 'text') return;

    // Update display state
    setDisplayedQuestions(prev => new Map(prev).set(requestId, targetRequest!));

    // Send display message via data channel
    const message: RequestDisplayMessage = {
      type: 'REQUEST_DISPLAY',
      payload: {
        requestId,
        question: targetRequest.question || '',
        studentName: targetRequest.studentName,
        display: true,
      },
    };

    const encoder = new TextEncoder();
    room.localParticipant.publishData(
      encoder.encode(JSON.stringify(message)),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);

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

  // Mobile detection and max width calculation effect
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      // Update max translation width to 70% of viewport
      setMaxTranslationWidth(window.innerWidth * 0.7);
    };

    // Check on mount
    handleResize();

    // Listen for window resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div className={styles.speechContainer} data-lk-theme="default">
      {/* Fixed header with room info and request dropdown */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.roomInfo}>
            <span className={styles.roomName}>bayaan.ai</span>
          </div>

          <div className={styles.headerControls}>
            {/* Teacher controls */}
            {isTeacher && (<>
              {/* Copy student link button */}
              <button
                className={`${styles.copyLinkButton} ${linkCopied ? styles.copied : ''}`}
                onClick={() => {
                  const studentLink = `${window.location.origin}/speech-s/${room.name}`;
                  navigator.clipboard.writeText(studentLink);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                title={linkCopied ? "Link copied!" : "Copy student link"}
                aria-label="Copy student link to clipboard"
              >
                {linkCopied ? <Check size={18} /> : <Clipboard size={18} />}
              </button>
            </>)}


            {/* Theme toggle - rightmost for all users */}
            <ThemeToggleButton start="top-right" />
          </div>
        </div>
      </div>

      {/* Connection state notification */}
      <ConnectionStateToast />

      {/* Main container with column layout */}
      <div className={`${styles.mainContainer} ${!isTeacher ? styles.withTranslation : ''}`}>
        {/* Video area - contains teacher video and sidebars */}
        <div className={styles.videoArea}>
          {/* Translation sidebar - only for students, always visible (desktop only) */}
          {!isTeacher && (
            <div
              ref={translationRef}
              className={`${styles.translationSidebar} ${styles.desktopOnly}`}
              style={{
                display: 'flex',
                width: `${translationResize.width}px`
              }}
            >
              <SpeechTranslationPanel
                targetLanguage={captionsLanguage}
                hideCloseButton={true}
              />
              <div
                className={styles.resizeHandle}
                onMouseDown={translationResize.handleMouseDown}
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
                {/* Teacher video/screen share */}
                {teacher && (
                  <div className={teacherScreenShareTrack ? styles.teacherScreenShareLayout : styles.teacherVideo}>
                    {/* Display screen share as primary if active */}
                    {teacherScreenShareTrack ? (
                      <>
                        {/* Main screen share display */}
                        <div className={styles.screenShareContainer}>
                          <CustomParticipantTile
                            trackRef={teacherScreenShareTrack}
                            className={styles.screenShareTile}
                            showSpeakingIndicator={false}
                          />
                        </div>

                        {/* Teacher camera as overlay/thumbnail when screen sharing */}
                        {teacherCameraTrack && (
                          <div className={styles.teacherCameraThumbnail}>
                            <CustomParticipantTile
                              trackRef={teacherCameraTrack}
                              className={styles.teacherThumbnailTile}
                              showSpeakingIndicator={true}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      /* Regular camera view when not screen sharing */
                      teacherCameraTrack ? (
                        <CustomParticipantTile
                          trackRef={teacherCameraTrack}
                          className={styles.teacherTile}
                          showSpeakingIndicator={true}
                        />
                      ) : (
                        <div className={styles.noVideoPlaceholder}>
                          <div className={styles.participantName}>
                            {teacher.name || 'Teacher'}
                          </div>
                          <div className={styles.noVideoText}>Camera Off</div>
                        </div>
                      )
                    )}

                    {/* Audio tracks */}
                    {teacherAudioTracks.map((track) => (
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

                  const metadata = parseParticipantMetadata(student.metadata);
                  const request = getParticipantRequest(student.identity);

                  return (
                    <div key={student.identity} className={styles.speakingStudentVideo}>
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

          {/* Chat sidebar - only for teachers */}
          {isTeacher && (
            <div
              className={styles.chatWrapper}
              style={{
                display: widget.state?.showChat ? '' : 'none',
                // Only apply desktop-specific styles for non-mobile
                ...(isMobile ? {} : {
                  width: `${chatResize.width}px`,
                  position: 'relative'
                })
              }}
            >
              <div
                className={styles.chatResizeHandle}
                onMouseDown={chatResize.handleMouseDown}
                title="Drag to resize"
              >
                <GripVertical className={styles.chatResizeGrip} size={24} />
              </div>
              <Chat
                className={styles.chatSidebar}
                style={isMobile ? { width: '100%' } : { width: '100%', height: '100%' }}
              />
            </div>
          )}
        </div>

        {/* Mobile translation panel - positioned between video area and students (mobile only) */}
        {!isTeacher && (
          <div className={styles.translationPanelMobile}>
            <SpeechTranslationPanel
              targetLanguage={captionsLanguage}
              hideCloseButton={true}
            />
          </div>
        )}

        {/* All Students section - Fixed at bottom - only for teachers */}
        {isTeacher && (
          <div className={styles.studentsSection}>
            <div className={styles.sectionHeader}>
              <h3>All Students ({allStudents.length})</h3>
            </div>

            <div className={styles.studentsGrid}>
              {allStudents.length > 0 ? (
                allStudents.map((student) => {
                  const metadata = parseParticipantMetadata(student.metadata);
                  const isSpeaking = metadata.role === 'student_speaker';
                  const request = getParticipantRequest(student.identity);

                  return (
                    <div
                      key={student.identity}
                      className={`${styles.studentTile} ${isSpeaking ? styles.speaking : ''}`}
                    >
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
                  <p>No students in the speech session</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control bar at the bottom - only for teachers */}
      {isTeacher && (
        <div className={styles.controlBar}>
          <CustomControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: true,
              chat: true,
              screenShare: true,
              leave: true,
              translation: false
            }}
            onTranslationClick={() => {}}
            showTranslation={false}
            isStudent={false}
          />
        </div>
      )}



      {/* Teacher Request Panel - Removed, now using SpeechHeaderRequestDropdown */}

      {/* Additional UI elements */}
      {process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' && <SettingsMenu />}
    </div>
  );
}