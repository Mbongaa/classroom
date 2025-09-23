import React, { useEffect, useState } from 'react';
import styles from './QuestionBubble.module.css';

interface QuestionBubbleProps {
  question: string;
  studentName: string;
  onClose?: () => void;
  isDisplayedToAll?: boolean;
  position?: { x: number; y: number };
}

export function QuestionBubble({
  question,
  studentName,
  onClose,
  isDisplayedToAll = false,
  position
}: QuestionBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 200);
  };

  const bubbleStyle: React.CSSProperties = position
    ? {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : {};

  return (
    <div
      className={`${styles.bubble} ${isVisible ? styles.visible : ''} ${
        isDisplayedToAll ? styles.displayedToAll : ''
      }`}
      style={bubbleStyle}
    >
      <div className={styles.header}>
        <span className={styles.studentName}>{studentName}</span>
        {(onClose || isDisplayedToAll) && (
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close question"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.content}>
        <p className={styles.question}>{question}</p>
      </div>
      {isDisplayedToAll && (
        <div className={styles.badge}>
          <span className={styles.badgeText}>Displayed to All</span>
        </div>
      )}
      <div className={styles.tail} />
    </div>
  );
}