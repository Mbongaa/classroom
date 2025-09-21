import React, { useState } from 'react';
import { useRoomContext } from '@livekit/components-react';

export function CopyStudentLinkButton() {
  const room = useRoomContext();
  const [copied, setCopied] = useState(false);

  // Check if current participant is a teacher
  const isTeacher = React.useMemo(() => {
    try {
      const metadata = room.localParticipant?.metadata;
      if (metadata) {
        const parsed = JSON.parse(metadata);
        return parsed.role === 'teacher';
      }
    } catch {
      // If metadata parsing fails, assume not a teacher
    }
    return false;
  }, [room.localParticipant?.metadata]);

  // Only show button for teachers in classroom mode
  if (!isTeacher) {
    return null;
  }

  const copyStudentLink = async () => {
    const roomName = room.name;
    const baseUrl = window.location.origin;

    // Check if there's a PIN in the teacher's metadata
    let studentLink = `${baseUrl}/s/${roomName}`;
    try {
      const metadata = room.localParticipant?.metadata;
      if (metadata) {
        const parsed = JSON.parse(metadata);
        if (parsed.classroomPin) {
          studentLink += `?pin=${parsed.classroomPin}`;
        }
      }
    } catch {
      // If metadata parsing fails, just use the basic link
    }

    try {
      await navigator.clipboard.writeText(studentLink);
      setCopied(true);

      // Reset the copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = studentLink;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        alert(`Student link: ${studentLink}`);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      className="lk-button lk-button-menu"
      onClick={copyStudentLink}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        background: copied
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        border: 'none',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        fontSize: '0.95rem',
        fontWeight: 'bold',
      }}
      title="Copy link for students to join this classroom"
    >
      {copied ? (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }}
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Link Copied!
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          Copy Student Link
        </>
      )}
    </button>
  );
}