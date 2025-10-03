'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/contexts/UserContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import Link from 'next/link';
import { Play, Download, Trash2, Clock, Calendar } from 'lucide-react';

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

export default function RecordingsPage() {
  const { user, profile, loading: userLoading } = useUser();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const response = await fetch('/api/recordings');
        if (!response.ok) throw new Error('Failed to fetch recordings');

        const data = await response.json();
        setRecordings(data.recordings || []);
      } catch (error) {
        console.error('Failed to fetch recordings:', error);
        setError(error instanceof Error ? error.message : 'Failed to load recordings');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchRecordings();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const handleDelete = async (recordingId: string, roomName: string) => {
    if (!confirm(`Delete recording for ${roomName}? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete recording');

      // Refresh list
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    } catch (error) {
      console.error('Failed to delete recording:', error);
      alert('Failed to delete recording');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!user || !profile) {
    return <div>Not authenticated</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <p className="text-red-500">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session Recordings</h1>
        <p className="text-muted-foreground">View and manage your classroom recordings</p>
      </div>

      {recordings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No recordings yet. Start recording a session to see it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card key={recording.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{recording.room_name}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ml-2 ${
                      recording.status === 'COMPLETED'
                        ? 'bg-green-500/20 text-green-500'
                        : recording.status === 'ACTIVE'
                        ? 'bg-blue-500/20 text-blue-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}
                  >
                    {recording.status}
                  </span>
                </CardTitle>
                <CardDescription className="truncate">{recording.teacher_name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{new Date(recording.started_at).toLocaleString()}</span>
                  </div>
                  {recording.duration_seconds && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span>{formatDuration(recording.duration_seconds)}</span>
                    </div>
                  )}
                </div>

                {recording.status === 'COMPLETED' && recording.hls_playlist_url ? (
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/dashboard/recordings/${recording.id}`}>
                        <Play className="h-4 w-4 mr-2" />
                        Watch
                      </Link>
                    </Button>
                    {recording.mp4_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={recording.mp4_url} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(recording.id, recording.room_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    {recording.status === 'ACTIVE'
                      ? 'Recording in progress...'
                      : recording.status === 'FAILED'
                      ? 'Recording failed'
                      : 'Processing...'}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
