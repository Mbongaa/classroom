import React, { useState, useRef, useEffect } from 'react';
import { StudentRequest } from './types/StudentRequest';
import {
  Hand,
  ChevronDown,
  ChevronUp,
  Mic,
  MessageCircle,
  FileText,
  Check,
  X,
  Monitor,
  CheckCircle,
} from 'lucide-react';
import styles from './HeaderRequestDropdown.module.css';

interface HeaderRequestDropdownProps {
  requests: StudentRequest[];
  onApprove: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onDisplay: (requestId: string) => void;
  onMarkAnswered: (requestId: string) => void;
}

export function HeaderRequestDropdown({
  requests,
  onApprove,
  onDecline,
  onDisplay,
  onMarkAnswered,
}: HeaderRequestDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousRequestCount = useRef(requests.length);

  // Detect new requests for notification
  useEffect(() => {
    if (requests.length > previousRequestCount.current) {
      setHasNewRequest(true);
      // Visual notification
      setTimeout(() => setHasNewRequest(false), 3000);
    }
    previousRequestCount.current = requests.length;
  }, [requests.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const getRequestIcon = (request: StudentRequest) => {
    return request.type === 'voice' ? <Mic size={20} /> : <MessageCircle size={20} />;
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button
        className={`${styles.dropdownButton} ${hasNewRequest ? styles.newRequest : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Student requests. ${pendingRequests.length} pending`}
      >
        <Hand size={18} className={styles.buttonIcon} />
        <span className={styles.buttonText}>Requests</span>
        {pendingRequests.length > 0 && (
          <span className={styles.badge}>{pendingRequests.length}</span>
        )}
        {isOpen ? (
          <ChevronUp size={16} className={styles.dropdownArrow} />
        ) : (
          <ChevronDown size={16} className={styles.dropdownArrow} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Student Requests</span>
            <span className={styles.requestCount}>{pendingRequests.length} pending</span>
          </div>

          <div className={styles.requestList}>
            {pendingRequests.length === 0 ? (
              <div className={styles.empty}>
                <FileText size={48} className={styles.emptyIcon} />
                <div className={styles.emptyText}>No pending requests</div>
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className={styles.request}>
                  <div className={styles.requestHeader}>
                    <span className={styles.requestType}>{getRequestIcon(request)}</span>
                    <span className={styles.studentName}>{request.studentName}</span>
                    <span className={styles.requestTime}>{formatTime(request.timestamp)}</span>
                  </div>

                  {request.type === 'text' && request.question && (
                    <div className={styles.questionText}>&quot;{request.question}&quot;</div>
                  )}

                  <div className={styles.actions}>
                    {request.type === 'voice' ? (
                      <>
                        <button
                          className={styles.approveButton}
                          onClick={() => onApprove(request.id)}
                          title="Grant speaking permission"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          className={styles.declineButton}
                          onClick={() => onDecline(request.id)}
                          title="Decline request"
                        >
                          <X size={14} /> Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={styles.displayButton}
                          onClick={() => onDisplay(request.id)}
                          title="Display question to all"
                        >
                          <Monitor size={14} /> Display
                        </button>
                        <button
                          className={styles.answeredButton}
                          onClick={() => onMarkAnswered(request.id)}
                          title="Mark as answered"
                        >
                          <CheckCircle size={14} /> Answered
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
