import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Participant } from 'livekit-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, UserX, X } from 'lucide-react';
import styles from './AvatarWithDropdown.module.css';

interface AvatarWithDropdownProps {
  participant: Participant;
  roomName: string;
  teacherToken: string;
  onPermissionUpdate: (participantIdentity: string, action: 'grant' | 'revoke') => void;
  currentRole?: string;
  isTeacher: boolean;
  getInitials: (name: string | undefined) => string;
}

export function AvatarWithDropdown({
  participant,
  roomName,
  teacherToken,
  onPermissionUpdate,
  currentRole,
  isTeacher,
  getInitials
}: AvatarWithDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const avatarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position relative to avatar
  const updatePosition = () => {
    if (avatarRef.current && isOpen) {
      const avatarRect = avatarRef.current.getBoundingClientRect();
      const menuHeight = 200; // Approximate menu height
      const menuWidth = 180;

      // Position below avatar by default
      let top = avatarRect.bottom + 8;
      let left = avatarRect.left + (avatarRect.width / 2) - (menuWidth / 2);

      // If menu would go below viewport, show it above the avatar
      if (top + menuHeight > window.innerHeight) {
        top = avatarRect.top - menuHeight - 8;
      }

      // Keep menu within horizontal bounds
      if (left < 0) {
        left = 10;
      }
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
      }

      setDropdownPosition({ top, left });
    }
  };

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        avatarRef.current &&
        menuRef.current &&
        !avatarRef.current.contains(event.target as Node) &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePermissionToggle = async () => {
    const action = currentRole === 'student_speaker' ? 'revoke' : 'grant';
    setIsLoading(true);

    try {
      const response = await fetch('/api/update-student-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          studentIdentity: participant.identity,
          studentName: participant.name || 'Student',
          action,
          teacherToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onPermissionUpdate(participant.identity, action);
        setIsOpen(false);
      } else {
        console.error('Failed to update permissions:', data.error);
        alert(`Failed to ${action} speaking permission: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Failed to update permissions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async () => {
    if (confirm(`Are you sure you want to remove ${participant.name || 'this student'} from the classroom?`)) {
      setIsLoading(true);

      try {
        const response = await fetch('/api/remove-participant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName,
            participantIdentity: participant.identity,
            teacherToken,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setIsOpen(false);
        } else {
          console.error('Failed to remove participant:', data.error);
          alert(`Failed to remove participant: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error removing participant:', error);
        alert('Failed to remove participant. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isSpeaker = currentRole === 'student_speaker';

  return (
    <>
      {/* Avatar - clickable for teachers */}
      <div
        ref={avatarRef}
        className={isTeacher ? styles.avatarClickable : ""}
        onClick={isTeacher ? () => setIsOpen(!isOpen) : undefined}
        title={isTeacher ? "Click to manage student" : undefined}
      >
        <Avatar className={`w-16 h-16 mx-auto border-2 ${isTeacher ? 'border-gray-700 hover:border-gray-500 transition-colors' : 'border-gray-700'}`}>
          <AvatarFallback
            className="text-xl font-semibold"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--lk-text1, white)'
            }}
          >
            {getInitials(participant.name || 'Student')}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Dropdown menu - only for teachers, rendered in portal */}
      {isTeacher && isOpen && createPortal(
        <div
          ref={menuRef}
          className={styles.dropdownMenu}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 10000,
          }}
        >
          <div className={styles.menuHeader}>
            {participant.name || 'Student'}
          </div>

          {!isSpeaker ? (
            <button
              className={`${styles.menuItem} ${styles.grantButton}`}
              onClick={handlePermissionToggle}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className={styles.loadingIcon}>⏳</span>
              ) : (
                <Mic size={16} />
              )}
              <span>{isLoading ? 'Granting...' : 'Grant Speaking'}</span>
            </button>
          ) : (
            <button
              className={`${styles.menuItem} ${styles.revokeButton}`}
              onClick={handlePermissionToggle}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className={styles.loadingIcon}>⏳</span>
              ) : (
                <MicOff size={16} />
              )}
              <span>{isLoading ? 'Revoking...' : 'Revoke Speaking'}</span>
            </button>
          )}

          <button
            className={`${styles.menuItem} ${styles.removeButton}`}
            onClick={handleRemoveParticipant}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.loadingIcon}>⏳</span>
            ) : (
              <UserX size={16} />
            )}
            <span>{isLoading ? 'Removing...' : 'Remove from Room'}</span>
          </button>

          <div className={styles.menuDivider}></div>

          <button
            className={`${styles.menuItem} ${styles.cancelButton}`}
            onClick={() => setIsOpen(false)}
          >
            <X size={16} />
            <span>Cancel</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// Memoize for performance - only re-render when participant or role changes
export default React.memo(AvatarWithDropdown, (prevProps, nextProps) => {
  return (
    prevProps.participant.identity === nextProps.participant.identity &&
    prevProps.participant.name === nextProps.participant.name &&
    prevProps.currentRole === nextProps.currentRole &&
    prevProps.roomName === nextProps.roomName &&
    prevProps.teacherToken === nextProps.teacherToken &&
    prevProps.isTeacher === nextProps.isTeacher
  );
});