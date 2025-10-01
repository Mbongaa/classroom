import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
      <Alert variant="default" className={`${styles.alertContainer} border-border`}>
        <MessageCircle className="h-4 w-4" />
        <AlertTitle className={styles.alertTitle}>
          {studentName}
          {isDisplayedToAll && (
            <span className={styles.badge}>Displayed to All</span>
          )}
        </AlertTitle>
        <AlertDescription className={styles.alertDescription}>
          {question}
        </AlertDescription>
        {(onClose || isDisplayedToAll) && (
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close question"
          >
            ×
          </button>
        )}
      </Alert>
    </div>
  );
}