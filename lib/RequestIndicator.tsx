import React, { useState, useCallback } from 'react';
import { StudentRequest } from './types/StudentRequest';
import { QuestionBubble } from './QuestionBubble';
import styles from './RequestIndicator.module.css';

interface RequestIndicatorProps {
  request: StudentRequest;
  participantName: string;
  isTeacher: boolean;
  onQuestionDisplay?: (requestId: string) => void;
}

export function RequestIndicator({
  request,
  participantName,
  isTeacher,
  onQuestionDisplay,
}: RequestIndicatorProps) {
  const [showBubble, setShowBubble] = useState(false);

  const handleClick = useCallback(() => {
    if (request.type === 'text' && request.question) {
      setShowBubble(!showBubble);
      if (isTeacher && onQuestionDisplay) {
        onQuestionDisplay(request.id);
      }
    }
  }, [request, showBubble, isTeacher, onQuestionDisplay]);

  const getIndicatorIcon = () => {
    if (request.status === 'approved') {
      return '✅';
    } else if (request.status === 'declined') {
      return '❌';
    } else if (request.type === 'voice') {
      return '🎤';
    } else {
      return '💬';
    }
  };

  const getIndicatorTitle = () => {
    if (request.status === 'approved') {
      return 'Request approved';
    } else if (request.status === 'declined') {
      return 'Request declined';
    } else if (request.type === 'voice') {
      return 'Requesting to speak';
    } else {
      return request.question ? 'Click to view question' : 'Has a question';
    }
  };

  return (
    <>
      <div
        className={`${styles.indicator} ${styles[request.status]} ${styles[request.type]}`}
        onClick={handleClick}
        title={getIndicatorTitle()}
        role="button"
        tabIndex={0}
        aria-label={getIndicatorTitle()}
      >
        <span className={styles.icon}>✋</span>
        {request.type === 'text' && <span className={styles.typeIcon}>{getIndicatorIcon()}</span>}
      </div>

      {showBubble && request.type === 'text' && request.question && (
        <QuestionBubble
          question={request.question}
          studentName={participantName}
          onClose={() => setShowBubble(false)}
          isDisplayedToAll={request.status === 'displayed'}
        />
      )}
    </>
  );
}

// Memoize for performance - only re-render when request status/content changes
export default React.memo(RequestIndicator, (prevProps, nextProps) => {
  return (
    prevProps.request.id === nextProps.request.id &&
    prevProps.request.status === nextProps.request.status &&
    prevProps.request.type === nextProps.request.type &&
    prevProps.request.question === nextProps.request.question &&
    prevProps.participantName === nextProps.participantName &&
    prevProps.isTeacher === nextProps.isTeacher
  );
});
