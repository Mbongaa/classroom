import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Participant } from 'livekit-client';

interface PermissionDropdownPortalProps {
  participant: Participant;
  roomName: string;
  teacherToken: string;
  onPermissionUpdate: (participantIdentity: string, action: 'grant' | 'revoke') => void;
  currentRole?: string;
}

export function PermissionDropdownPortal({
  participant,
  roomName,
  teacherToken,
  onPermissionUpdate,
  currentRole,
}: PermissionDropdownPortalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position relative to trigger button
  const updatePosition = () => {
    if (triggerRef.current && isOpen) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 200; // Approximate menu height
      const menuWidth = 180;

      // Check if menu would go off-screen
      let top = triggerRect.bottom + 8;
      let left = triggerRect.right - menuWidth;

      // If menu would go below viewport, show it above the trigger
      if (top + menuHeight > window.innerHeight) {
        top = triggerRect.top - menuHeight - 8;
      }

      // Keep menu within horizontal bounds
      if (left < 0) {
        left = triggerRect.left;
      }
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
      }

      setDropdownPosition({ top, left });
    }
  };

  // Update position when opening or window resizes
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      // Use capture phase to catch clicks before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  const handlePermissionChange = async (action: 'grant' | 'revoke') => {
    if (isLoading) return;

    setIsLoading(true);
    setIsOpen(false);

    try {
      const response = await fetch('/api/update-student-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          studentIdentity: participant.identity,
          studentName: participant.name,
          action,
          teacherToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Notify parent component of successful update
        onPermissionUpdate(participant.identity, action);
      } else {
        console.error('Failed to update permissions:', data.error);
        alert(`Failed to update permissions: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Failed to update permissions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async () => {
    if (confirm(`Remove ${participant.name || 'this student'} from the classroom?`)) {
      setIsLoading(true);
      setIsOpen(false);

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

        if (!response.ok || !data.success) {
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
      {/* Trigger button - stays in the student tile */}
      <button
        ref={triggerRef}
        className="permission-dropdown-trigger-portal"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        aria-label="Student permissions"
        title="Manage student permissions"
      >
        {isLoading ? (
          <span className="permission-dropdown-loading">⏳</span>
        ) : (
          <span className="permission-dropdown-icon">⚙️</span>
        )}
      </button>

      {/* Dropdown menu - rendered in portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="permission-dropdown-menu-portal"
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              zIndex: 10000,
            }}
          >
            <div className="permission-dropdown-header">
              {participant.name || 'Student'} - Permissions
            </div>

            {!isSpeaker ? (
              <button
                className="permission-dropdown-item permission-grant"
                onClick={() => handlePermissionChange('grant')}
                disabled={isLoading}
              >
                <span className="permission-icon">🎤</span>
                <span>Grant Speaking</span>
              </button>
            ) : (
              <button
                className="permission-dropdown-item permission-revoke"
                onClick={() => handlePermissionChange('revoke')}
                disabled={isLoading}
              >
                <span className="permission-icon">🔇</span>
                <span>Revoke Speaking</span>
              </button>
            )}

            <button
              className="permission-dropdown-item permission-remove"
              onClick={handleRemoveParticipant}
              disabled={isLoading}
            >
              <span className="permission-icon">❌</span>
              <span>Remove from Class</span>
            </button>
          </div>,
          document.body,
        )}

      <style jsx>{`
        .permission-dropdown-trigger-portal {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          z-index: 10;
        }

        .permission-dropdown-trigger-portal:hover {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .permission-dropdown-trigger-portal:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .permission-dropdown-loading {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <style jsx global>{`
        .permission-dropdown-menu-portal {
          min-width: 200px;
          background-color: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: dropdownOpen 0.2s ease;
        }

        @keyframes dropdownOpen {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .permission-dropdown-header {
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
        }

        .permission-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          background: none;
          border: none;
          color: white;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .permission-dropdown-item:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .permission-dropdown-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .permission-grant:hover {
          background-color: rgba(76, 175, 80, 0.2);
        }

        .permission-revoke:hover {
          background-color: rgba(255, 152, 0, 0.2);
        }

        .permission-remove:hover {
          background-color: rgba(244, 67, 54, 0.2);
        }

        .permission-icon {
          font-size: 18px;
        }
      `}</style>
    </>
  );
}
