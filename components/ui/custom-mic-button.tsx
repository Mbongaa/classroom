'use client';

import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CustomMicButton() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  return (
    <Button
      onClick={toggle}
      variant={isEnabled ? 'default' : 'destructive'}
      size="lg"
    >
      {isEnabled ? <Mic className="mr-2" /> : <MicOff className="mr-2" />}
      {isEnabled ? 'Mute' : 'Unmute'}
    </Button>
  );
}