'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle } from 'lucide-react';
import PulsatingLoader from '@/components/ui/pulsating-loader';

interface VideoPlayerProps {
  hlsPlaylistUrl: string;
  mp4Url?: string;
  recordingId: string;
  showDownload?: boolean;
  className?: string;
}

/**
 * VideoPlayer - Reusable HLS Video Player Component
 *
 * Features:
 * - HLS.js for adaptive streaming
 * - Native HLS support for iOS Safari
 * - Optional MP4 download
 * - Error handling and recovery
 * - Proper cleanup on unmount
 */
export default function VideoPlayer({
  hlsPlaylistUrl,
  mp4Url,
  recordingId,
  showDownload = true,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize HLS player
  useEffect(() => {
    if (!hlsPlaylistUrl || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    // iOS Safari supports HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsPlaylistUrl;
      console.log('[VideoPlayer] Using native HLS support (iOS Safari)');
      setIsLoading(false);
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // VOD playback
      });

      hls.loadSource(hlsPlaylistUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] Manifest loaded successfully');
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[VideoPlayer] Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[VideoPlayer] Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[VideoPlayer] Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[VideoPlayer] Unrecoverable error');
              setError('Failed to load video');
              setIsLoading(false);
              break;
          }
        }
      });
    } else {
      setError('HLS playback not supported in this browser');
      setIsLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsPlaylistUrl]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-lg bg-destructive/10 ${className}`}
      >
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
            <PulsatingLoader />
          </div>
        )}
        <video
          ref={videoRef}
          controls
          className="w-full aspect-video bg-black rounded-lg"
          playsInline
        >
          Your browser does not support video playback.
        </video>
      </div>

      {/* Download Button */}
      {showDownload && mp4Url && (
        <div className="flex justify-end print:hidden">
          <Button asChild variant="outline" size="sm">
            <a href={mp4Url} download>
              <Download className="h-4 w-4 mr-2" />
              Download MP4
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
