'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import Link from 'next/link';
import { Download, ArrowLeft } from 'lucide-react';

interface Recording {
  id: string;
  room_name: string;
  session_id: string;
  teacher_name: string;
  hls_playlist_url: string | null;
  mp4_url: string | null;
  duration_seconds: number | null;
  started_at: string;
  status: string;
}

export default function RecordingPlaybackPage() {
  const params = useParams();
  const recordingId = params.recordingId as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recording details
  useEffect(() => {
    const fetchRecording = async () => {
      try {
        const response = await fetch(`/api/recordings/${recordingId}`);
        if (!response.ok) {
          throw new Error('Recording not found');
        }

        const data = await response.json();
        setRecording(data.recording);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId]);

  // Initialize HLS player
  useEffect(() => {
    if (!recording?.hls_playlist_url || !videoRef.current) return;

    const video = videoRef.current;

    // iOS Safari supports HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = recording.hls_playlist_url;
      console.log('[HLS Player] Using native HLS support (iOS Safari)');
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // VOD playback
      });

      hls.loadSource(recording.hls_playlist_url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS Player] Manifest loaded successfully');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[HLS Player] Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS Player] Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS Player] Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS Player] Unrecoverable error');
              setError('Failed to load video');
              break;
          }
        }
      });
    } else {
      setError('HLS playback not supported in this browser');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [recording]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <p className="text-red-500 mb-4">{error || 'Recording not found'}</p>
          <Button asChild>
            <Link href="/dashboard/recordings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Recordings
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (recording.status !== 'COMPLETED' || !recording.hls_playlist_url) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{recording.room_name}</h1>
          <p className="text-muted-foreground">
            {recording.teacher_name} • {new Date(recording.started_at).toLocaleString()}
          </p>
        </div>

        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">
            {recording.status === 'ACTIVE'
              ? 'Recording is still in progress...'
              : recording.status === 'FAILED'
                ? 'Recording failed. Please try again.'
                : 'Recording is being processed...'}
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/recordings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Recordings
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{recording.room_name}</h1>
          <p className="text-muted-foreground">
            {recording.teacher_name} • {new Date(recording.started_at).toLocaleString()}
            {recording.duration_seconds && ` • ${formatDuration(recording.duration_seconds)}`}
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard/recordings">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Video Player */}
      <Card>
        <CardHeader>
          <CardTitle>Recording Playback</CardTitle>
        </CardHeader>
        <CardContent>
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video bg-black rounded-lg"
            playsInline
          >
            Your browser does not support video playback.
          </video>

          {/* Download Button */}
          {recording.mp4_url && (
            <div className="mt-4 flex justify-end">
              <Button asChild variant="outline">
                <a href={recording.mp4_url} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Session ID:</span>
            <span className="font-mono">{recording.session_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room:</span>
            <span>{recording.room_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Teacher:</span>
            <span>{recording.teacher_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recorded:</span>
            <span>{new Date(recording.started_at).toLocaleString()}</span>
          </div>
          {recording.duration_seconds && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span>{formatDuration(recording.duration_seconds)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
