import React, { useState, useRef, useEffect } from 'react';
import { StudentRequest } from './types/StudentRequest';
import {
  Hand,
  ChevronDown,
  ChevronUp,
  Mic,
  MessageCircle,
  Clock,
  Send
} from 'lucide-react';
import styles from './StudentRequestDropdown.module.css';

interface StudentRequestDropdownProps {
  activeRequest: StudentRequest | null;
  onSubmit: (type: 'voice' | 'text', question?: string) => void;
}

export function StudentRequestDropdown({
  activeRequest,
  onSubmit
}: StudentRequestDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestType, setRequestType] = useState<'voice' | 'text' | null>(null);
  const [textQuestion, setTextQuestion] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Reset form when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setRequestType(null);
      setTextQuestion('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (requestType === 'voice') {
      onSubmit('voice');
      setIsOpen(false);
    } else if (requestType === 'text' && textQuestion.trim()) {
      onSubmit('text', textQuestion.trim());
      setIsOpen(false);
    }
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
        className={`${styles.dropdownButton} ${activeRequest ? styles.hasActiveRequest : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={!!activeRequest}
        aria-expanded={isOpen}
        aria-label={activeRequest ? 'Request pending' : 'Raise hand'}
      >
        {activeRequest ? (
          <>
            <Clock size={18} className={`${styles.buttonIcon} ${styles.pending}`} />
            <span className={styles.buttonText}>Pending</span>
          </>
        ) : (
          <>
            <Hand size={18} className={styles.buttonIcon} />
            <span className={styles.buttonText}>Raise Hand</span>
          </>
        )}
        {!activeRequest && (
          isOpen ? <ChevronUp size={16} className={styles.dropdownArrow} /> : <ChevronDown size={16} className={styles.dropdownArrow} />
        )}
      </button>

      {isOpen && !activeRequest && (
        <div className={styles.dropdownPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Ask a Question</span>
          </div>

          {!requestType ? (
            <div className={styles.requestOptions}>
              <div className={styles.optionDescription}>
                How would you like to ask your question?
              </div>

              <button
                className={styles.optionButton}
                onClick={() => setRequestType('voice')}
              >
                <Mic size={24} className={styles.optionIcon} />
                <div className={styles.optionContent}>
                  <div className={styles.optionTitle}>Request to Speak</div>
                  <div className={styles.optionSubtitle}>Ask your question verbally</div>
                </div>
              </button>

              <button
                className={styles.optionButton}
                onClick={() => setRequestType('text')}
              >
                <MessageCircle size={24} className={styles.optionIcon} />
                <div className={styles.optionContent}>
                  <div className={styles.optionTitle}>Type a Question</div>
                  <div className={styles.optionSubtitle}>Submit a written question</div>
                </div>
              </button>
            </div>
          ) : requestType === 'voice' ? (
            <div className={styles.confirmSection}>
              <div className={styles.confirmIcon}>
                <Mic size={32} />
              </div>
              <div className={styles.confirmText}>
                Request permission to speak?
              </div>
              <div className={styles.confirmSubtext}>
                The teacher will be notified of your request
              </div>
              <div className={styles.confirmButtons}>
                <button
                  className={styles.cancelButton}
                  onClick={() => setRequestType(null)}
                >
                  Cancel
                </button>
                <button
                  className={styles.submitButton}
                  onClick={handleSubmit}
                >
                  Request to Speak
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.textSection}>
              <div className={styles.textHeader}>
                <MessageCircle size={20} />
                <span>Type your question</span>
              </div>
              <textarea
                className={styles.textInput}
                placeholder="What would you like to ask?"
                value={textQuestion}
                onChange={(e) => setTextQuestion(e.target.value)}
                maxLength={200}
                autoFocus
              />
              <div className={styles.textFooter}>
                <span className={styles.charCount}>
                  {textQuestion.length}/200
                </span>
                <div className={styles.textButtons}>
                  <button
                    className={styles.cancelButton}
                    onClick={() => setRequestType(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.submitButton}
                    onClick={handleSubmit}
                    disabled={!textQuestion.trim()}
                  >
                    <Send size={14} />
                    Submit Question
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeRequest && (
            <div className={styles.activeRequestInfo}>
              <Clock size={16} />
              <span>Your {activeRequest.type === 'voice' ? 'speaking' : 'question'} request was sent {formatTime(activeRequest.timestamp)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}