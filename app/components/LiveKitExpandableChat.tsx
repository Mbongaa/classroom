'use client';

import React from 'react';
import { useChat, useLocalParticipant } from '@livekit/components-react';
import { ExpandableChat, ChatMessage } from '@/components/ui/expandable-chat';

export function LiveKitExpandableChat() {
  const { chatMessages, send } = useChat();
  const localParticipant = useLocalParticipant();

  // Convert LiveKit chat messages to our ChatMessage format
  const messages: ChatMessage[] = React.useMemo(() => {
    return chatMessages.map((msg) => {
      const isLocalParticipant = msg.from?.identity === localParticipant.localParticipant?.identity;

      return {
        id: msg.id || `${msg.timestamp}-${msg.from?.identity}`,
        message: msg.message,
        sender: {
          name: msg.from?.name || msg.from?.identity || 'Unknown',
          avatar: undefined, // LiveKit doesn't provide avatars by default
        },
        timestamp: new Date(msg.timestamp),
        isSent: isLocalParticipant, // Right-align messages from current user
      };
    });
  }, [chatMessages, localParticipant.localParticipant?.identity]);

  const handleSendMessage = React.useCallback(
    (message: string) => {
      if (message.trim()) {
        send(message);
      }
    },
    [send],
  );

  return <ExpandableChat messages={messages} onSendMessage={handleSendMessage} className="z-50" />;
}
