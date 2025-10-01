'use client';

import { useRoomContext } from '@livekit/components-react';
import { useState, useEffect } from 'react';
import { TranscriptionSegment, RoomEvent } from 'livekit-client';

interface CaptionsProps {
  captionsEnabled: boolean;
  captionsLanguage: string;
}

export default function Captions({ captionsEnabled, captionsLanguage }: CaptionsProps) {
  const room = useRoomContext();
  const [transcriptions, setTranscriptions] = useState<{
    [id: string]: TranscriptionSegment;
  }>({});

  useEffect(() => {
    if (!room) return;

    const updateTranscriptions = (segments: TranscriptionSegment[]) => {
      // Filter segments for the selected language
      const filteredSegments = segments.filter((seg) => seg.language === captionsLanguage);

      setTranscriptions((prev) => {
        const newTranscriptions = { ...prev };
        for (const segment of filteredSegments) {
          newTranscriptions[segment.id] = segment;
        }
        return newTranscriptions;
      });

      // Clean up old transcriptions (keep only last 5)
      setTranscriptions((prev) => {
        const sorted = Object.entries(prev).sort(
          ([, a], [, b]) => (b.startTime || 0) - (a.startTime || 0),
        );
        if (sorted.length > 5) {
          const keep = sorted.slice(0, 5);
          return Object.fromEntries(keep);
        }
        return prev;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, updateTranscriptions);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, updateTranscriptions);
    };
  }, [room, captionsLanguage]);

  // Display the last 2 caption segments
  const captionItems = Object.values(transcriptions)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
    .slice(-2);

  if (!captionsEnabled || captionItems.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50
                 max-w-4xl w-full px-4 pointer-events-none"
    >
      <div
        className="bg-black/80 backdrop-blur-sm rounded-lg px-6 py-4
                   transition-opacity duration-300"
        style={{ opacity: captionsEnabled ? 1 : 0 }}
      >
        {captionItems.map((segment, i) => (
          <p
            key={segment.id}
            className={`text-center text-white font-medium leading-relaxed
                      ${
                        i === 0 && captionItems.length > 1 ? 'text-lg opacity-70 mb-2' : 'text-xl'
                      }`}
          >
            {segment.text}
          </p>
        ))}
      </div>
    </div>
  );
}
