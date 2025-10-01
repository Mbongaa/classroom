'use client';

import React, { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';

interface Language {
  code: string;
  name: string;
  flag: string;
}

interface LanguageSelectProps {
  captionsLanguage: string;
  captionsEnabled: boolean;
  onLanguageChange: (language: string) => void;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({
  captionsLanguage,
  captionsEnabled,
  onLanguageChange,
}) => {
  const room = useRoomContext();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onLanguageChange(value);

    // Update participant attributes to notify the agent
    await room.localParticipant.setAttributes({
      captions_language: value,
    });
  };

  useEffect(() => {
    async function getLanguages() {
      if (room.state !== 'connected') return;

      try {
        // Find the agent participant (identity is "agent")
        const agentParticipant = Array.from(room.remoteParticipants.values()).find(
          (p) => p.identity === 'agent',
        );

        if (!agentParticipant) {
          console.log(
            'Translation agent not found in the room yet. Participants:',
            Array.from(room.remoteParticipants.values()).map((p) => p.identity),
          );
          return;
        }

        console.log('Found agent participant:', agentParticipant.identity);

        const response = await room.localParticipant.performRpc({
          destinationIdentity: agentParticipant.identity,
          method: 'get/languages',
          payload: '',
        });

        const languageList = JSON.parse(response);
        setLanguages(languageList);
        setIsLoading(false);

        // Set default language if not set
        if (!captionsLanguage && languageList.length > 0) {
          onLanguageChange(languageList[0].code);
        }
      } catch (error) {
        console.error('Failed to get languages from agent:', error);
      }
    }

    // Initial call
    getLanguages();

    // Poll for agent until it's found (agent may join after participants)
    const interval = setInterval(getLanguages, 3000);

    return () => clearInterval(interval);
  }, [room, room.state, captionsLanguage, onLanguageChange]);

  if (isLoading || languages.length === 0) {
    // Show a loading/waiting state instead of hiding completely
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">
          {isLoading ? '⏳ Loading languages...' : '⏳ Waiting for translation service...'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm text-gray-600">
        Caption Language:
      </label>
      <select
        id="language-select"
        value={captionsLanguage}
        onChange={handleChange}
        disabled={!captionsEnabled}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md
                 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelect;
