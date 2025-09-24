import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StudentRequest } from './types/StudentRequest';
import styles from './TeacherRequestPanel.module.css';

interface TeacherRequestPanelProps {
  requests: StudentRequest[];
  onApprove: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onDisplay: (requestId: string) => void;
  onMarkAnswered: (requestId: string) => void;
  isTeacher: boolean;
}

export function TeacherRequestPanel({
  requests,
  onApprove,
  onDecline,
  onDisplay,
  onMarkAnswered,
  isTeacher
}: TeacherRequestPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousRequestCount = useRef(requests.length);

  // Detect new requests for notification
  useEffect(() => {
    if (requests.length > previousRequestCount.current) {
      setHasNewRequest(true);
      // Visual notification only - audio removed to prevent 404 errors
      setTimeout(() => setHasNewRequest(false), 3000);
    }
    previousRequestCount.current = requests.length;
  }, [requests.length]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.header)) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 400, e.clientY - dragOffset.y))
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Only show for teachers
  if (!isTeacher) {
    return null;
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const getRequestIcon = (request: StudentRequest) => {
    return request.type === 'voice' ? '🎤' : '💬';
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div
      ref={panelRef}
      className={`${styles.panel} ${isMinimized ? styles.minimized : ''} ${
        hasNewRequest ? styles.newRequest : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.icon}>📋</span>
          <span>Student Requests ({pendingRequests.length})</span>
        </div>
        <button
          className={styles.toggleButton}
          onClick={() => setIsMinimized(!isMinimized)}
          aria-label={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {!isMinimized && (
        <div className={styles.content}>
          {pendingRequests.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>✅</span>
              <p className={styles.emptyText}>No pending requests</p>
            </div>
          ) : (
            <div className={styles.requestList}>
              {pendingRequests.map((request) => (
                <div key={request.id} className={styles.request}>
                  <div className={styles.requestHeader}>
                    <span className={styles.requestIcon}>
                      {getRequestIcon(request)}
                    </span>
                    <span className={styles.studentName}>
                      {request.studentName}
                    </span>
                    <span className={styles.time}>
                      {formatTime(request.timestamp)}
                    </span>
                  </div>

                  {request.type === 'voice' ? (
                    <div className={styles.requestContent}>
                      <p className={styles.requestType}>Wants to speak</p>
                    </div>
                  ) : (
                    <div className={styles.requestContent}>
                      <p className={styles.questionText}>&quot;{request.question}&quot;</p>
                    </div>
                  )}

                  <div className={styles.requestActions}>
                    {request.type === 'voice' ? (
                      <>
                        <button
                          className={`${styles.actionButton} ${styles.approve}`}
                          onClick={() => onApprove(request.id)}
                          title="Grant speaking permission"
                        >
                          Approve
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.decline}`}
                          onClick={() => onDecline(request.id)}
                          title="Decline request"
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`${styles.actionButton} ${styles.display}`}
                          onClick={() => onDisplay(request.id)}
                          title="Display question to all"
                        >
                          Display
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.answered}`}
                          onClick={() => onMarkAnswered(request.id)}
                          title="Mark as answered"
                        >
                          Answered
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}