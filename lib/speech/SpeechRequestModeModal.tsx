import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './RequestModeModal.module.css';

interface RequestModeModalProps {
  onClose: () => void;
  onSubmit: (type: 'voice' | 'text', question?: string) => void;
}

export function RequestModeModal({ onClose, onSubmit }: RequestModeModalProps) {
  const [mode, setMode] = useState<'selection' | 'voice' | 'text'>('selection');
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Focus text area when switching to text mode
  useEffect(() => {
    if (mode === 'text' && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [mode]);

  // Handle clicking outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleVoiceMode = useCallback(() => {
    setMode('voice');
  }, []);

  const handleTextMode = useCallback(() => {
    setMode('text');
  }, []);

  const handleBack = useCallback(() => {
    setMode('selection');
    setQuestion('');
  }, []);

  const handleVoiceSubmit = useCallback(() => {
    setIsSubmitting(true);
    onSubmit('voice');
  }, [onSubmit]);

  const handleTextSubmit = useCallback(() => {
    if (question.trim()) {
      setIsSubmitting(true);
      onSubmit('text', question.trim());
    }
  }, [question, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  return (
    <div className={styles.overlay}>
      <div ref={modalRef} className={styles.modal}>
        {/* Close button */}
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {/* Selection mode */}
        {mode === 'selection' && (
          <>
            <h2 className={styles.title}>How would you like to ask your question?</h2>
            <div className={styles.options}>
              <button
                className={styles.optionButton}
                onClick={handleVoiceMode}
                disabled={isSubmitting}
              >
                <span className={styles.optionIcon}>🎤</span>
                <span className={styles.optionLabel}>Ask by Voice</span>
                <span className={styles.optionDescription}>
                  Request to speak and ask verbally
                </span>
              </button>

              <button
                className={styles.optionButton}
                onClick={handleTextMode}
                disabled={isSubmitting}
              >
                <span className={styles.optionIcon}>💬</span>
                <span className={styles.optionLabel}>Ask by Text</span>
                <span className={styles.optionDescription}>
                  Type your question for display
                </span>
              </button>
            </div>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {/* Voice mode confirmation */}
        {mode === 'voice' && (
          <>
            <h2 className={styles.title}>Request to Speak</h2>
            <div className={styles.voiceConfirmation}>
              <div className={styles.voiceIcon}>🎤</div>
              <p className={styles.description}>
                You&apos;re requesting permission to speak. Once approved by the teacher,
                you&apos;ll be able to turn on your microphone and camera to ask your question.
              </p>
              <div className={styles.actions}>
                <button
                  className={styles.backButton}
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  className={styles.submitButton}
                  onClick={handleVoiceSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Requesting...' : 'Send Request'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Text mode input */}
        {mode === 'text' && (
          <>
            <h2 className={styles.title}>Type Your Question</h2>
            <div className={styles.textInput}>
              <textarea
                ref={textAreaRef}
                className={styles.textarea}
                placeholder="Enter your question here..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={200}
                disabled={isSubmitting}
              />
              <div className={styles.charCount}>
                {question.length}/200
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.backButton}
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  className={styles.submitButton}
                  onClick={handleTextSubmit}
                  disabled={!question.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Question'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}