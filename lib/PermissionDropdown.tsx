import React, { useState, useRef, useEffect } from 'react';
import { Participant } from 'livekit-client';

interface PermissionDropdownProps {
  participant: Participant;
  roomName: string;
  teacherToken: string;
  onPermissionUpdate: (participantIdentity: string, action: 'grant' | 'revoke') => void;
  currentRole?: string;
}

export function PermissionDropdown({
  participant,
  roomName,
  teacherToken,
  onPermissionUpdate,
  currentRole,
}: PermissionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const isSpeaker = currentRole === 'student_speaker';

  return (
    <div className="permission-dropdown" ref={dropdownRef}>
      <button
        className="permission-dropdown-trigger"
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

      {isOpen && (
        <div className="permission-dropdown-menu">
          <div className="permission-dropdown-header">Manage Permissions</div>

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
            onClick={async () => {
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
            }}
            disabled={isLoading}
          >
            <span className="permission-icon">❌</span>
            <span>Remove from Class</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .permission-dropdown {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 500;
        }

        .permission-dropdown-trigger {
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
        }

        .permission-dropdown-trigger:hover {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .permission-dropdown-trigger:disabled {
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

        .permission-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          min-width: 180px;
          background-color: var(--lk-background);
          border: 1px solid var(--lk-border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: dropdownOpen 0.2s ease;
          z-index: 1000;
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
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--lk-text-muted);
          border-bottom: 1px solid var(--lk-border-color);
        }

        .permission-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          color: var(--lk-text);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .permission-dropdown-item:hover {
          background-color: var(--lk-background-hover);
        }

        .permission-dropdown-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .permission-grant:hover {
          background-color: rgba(76, 175, 80, 0.1);
        }

        .permission-revoke:hover {
          background-color: rgba(255, 152, 0, 0.1);
        }

        .permission-remove:hover {
          background-color: rgba(244, 67, 54, 0.1);
        }

        .permission-icon {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
