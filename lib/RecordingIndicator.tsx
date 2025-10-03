import { useIsRecording } from '@livekit/components-react';

/**
 * Simple "Live" indicator badge for recording status
 * Shows animated red dot + "LIVE" text when recording is active
 */
export function RecordingIndicator() {
  const isRecording = useIsRecording();

  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="relative">
        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
        <div className="absolute inset-0 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-ping"></div>
      </div>
      <span className="text-xs sm:text-sm font-bold text-red-500 uppercase">Live</span>
    </div>
  );
}
