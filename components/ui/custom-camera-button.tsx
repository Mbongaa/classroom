'use client';

import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CustomCameraButton() {
  const { toggle, isEnabled } = useTrackToggle({
    source: Track.Source.Camera,
  });

  return (
    <Button
      onClick={toggle}
      variant={isEnabled ? 'secondary' : 'outline'}
      size="lg"
    >
      {isEnabled ? <Video className="mr-2" /> : <VideoOff className="mr-2" />}
      {isEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
    </Button>
  );
}