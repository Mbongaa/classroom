import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client';

interface PermissionNotification {
  type: 'permission_update';
  action: 'grant' | 'revoke';
  message: string;
  timestamp: number;
  grantedBy: string;
  token?: string;
}

interface StudentPermissionNotificationProps {
  notification: PermissionNotification | null;
  room: Room;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

export function StudentPermissionNotification({
  notification,
  room,
  onAccept,
  onDecline,
  onDismiss
}: StudentPermissionNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      // Auto-dismiss revoke notifications after 5 seconds
      if (notification.action === 'revoke') {
        const timer = setTimeout(() => {
          handleDismiss();
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [notification]);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Request camera and microphone permissions
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // Call parent's accept handler which will handle reconnection with new token
      onAccept();

      setIsVisible(false);
    } catch (error) {
      console.error('Failed to enable media devices:', error);
      alert('Failed to enable camera/microphone. Please check your permissions and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    onDecline();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    onDismiss();
    setIsVisible(false);
  };

  if (!notification || !isVisible) return null;

  const isGrant = notification.action === 'grant';

  return (
    <div className="permission-notification">
      <div className="notification-content">
        <div className="notification-icon">
          {isGrant ? '🎤' : 'ℹ️'}
        </div>

        <div className="notification-text">
          <div className="notification-title">
            {isGrant ? 'Speaking Permission Granted' : 'Speaking Permission Revoked'}
          </div>
          <div className="notification-message">
            {notification.message}
          </div>
          <div className="notification-from">
            by {notification.grantedBy}
          </div>
        </div>

        {isGrant && (
          <div className="notification-actions">
            <button
              className="notification-btn notification-accept"
              onClick={handleAccept}
              disabled={isProcessing}
            >
              {isProcessing ? 'Enabling...' : 'Enable Camera & Mic'}
            </button>
            <button
              className="notification-btn notification-decline"
              onClick={handleDecline}
              disabled={isProcessing}
            >
              Not Now
            </button>
          </div>
        )}

        <button
          className="notification-close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>

      <style jsx>{`
        .permission-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .notification-content {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background-color: var(--lk-background-2);
          border: 1px solid var(--lk-border-color);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          min-width: 400px;
          max-width: 600px;
        }

        .notification-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .notification-text {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-weight: 600;
          font-size: 15px;
          color: var(--lk-text);
          margin-bottom: 4px;
        }

        .notification-message {
          font-size: 13px;
          color: var(--lk-text-muted);
          line-height: 1.4;
        }

        .notification-from {
          font-size: 11px;
          color: var(--lk-text-muted);
          margin-top: 4px;
          font-style: italic;
        }

        .notification-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .notification-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .notification-accept {
          background-color: var(--lk-button-bg);
          color: var(--lk-button-text);
          border: none;
        }

        .notification-accept:hover:not(:disabled) {
          background-color: var(--lk-button-bg-hover);
        }

        .notification-decline {
          background-color: transparent;
          color: var(--lk-text-muted);
          border: 1px solid var(--lk-border-color);
        }

        .notification-decline:hover:not(:disabled) {
          background-color: var(--lk-background-hover);
        }

        .notification-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notification-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: none;
          border: none;
          color: var(--lk-text-muted);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }

        .notification-close:hover {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .permission-notification {
            top: 10px;
            left: 10px;
            right: 10px;
            transform: none;
          }

          .notification-content {
            min-width: auto;
            width: 100%;
            flex-direction: column;
            text-align: center;
          }

          .notification-actions {
            width: 100%;
            flex-direction: row;
          }

          .notification-btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}