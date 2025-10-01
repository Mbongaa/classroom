import React, { useState, useCallback } from 'react';
import { RequestModeModal } from './RequestModeModal';
import styles from './StudentRequestButton.module.css';

interface StudentRequestButtonProps {
  onRequestSubmit: (type: 'voice' | 'text', question?: string) => void;
  hasActiveRequest: boolean;
  isStudent: boolean;
}

export function StudentRequestButton({
  onRequestSubmit,
  hasActiveRequest,
  isStudent,
}: StudentRequestButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleButtonClick = useCallback(() => {
    if (!hasActiveRequest) {
      setShowModal(true);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [hasActiveRequest]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleRequestSubmit = useCallback(
    (type: 'voice' | 'text', question?: string) => {
      onRequestSubmit(type, question);
      setShowModal(false);
    },
    [onRequestSubmit],
  );

  // Only show for students
  if (!isStudent) {
    return null;
  }

  return (
    <>
      <button
        className={`${styles.requestButton} ${hasActiveRequest ? styles.active : ''} ${isAnimating ? styles.animating : ''}`}
        onClick={handleButtonClick}
        disabled={hasActiveRequest}
        aria-label={hasActiveRequest ? 'Request pending' : 'Raise hand'}
        title={hasActiveRequest ? 'Your request is pending' : 'Ask a question'}
      >
        <span className={styles.icon}>{hasActiveRequest ? '⏳' : '✋'}</span>
        {hasActiveRequest && <span className={styles.badge}>Pending</span>}
      </button>

      {showModal && <RequestModeModal onClose={handleModalClose} onSubmit={handleRequestSubmit} />}
    </>
  );
}
