'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/UserContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ActiveSession {
  id: string | null;
  room_name: string;
  session_id: string | null;
  started_at: string;
  num_participants: number;
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function SuperadminSessionsPage() {
  const { profile, loading: userLoading } = useUser();
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (!userLoading && (!profile || !profile.is_superadmin)) {
      router.replace('/dashboard');
      return;
    }
  }, [profile, userLoading, router]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/sessions');
      if (!res.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await res.json();
      setSessions(data.sessions);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.is_superadmin) return;

    fetchSessions();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [profile, fetchSessions]);

  if (userLoading || !profile?.is_superadmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Sessions</h1>
          <p className="text-muted-foreground">
            Live sessions across the platform. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room Name</TableHead>
              <TableHead>Session ID</TableHead>
              <TableHead className="text-right">Participants</TableHead>
              <TableHead>Started At</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No active sessions.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session, idx) => (
                <TableRow key={session.id ?? `live-${idx}`}>
                  <TableCell className="font-medium">{session.room_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.session_id ?? (
                      <Badge variant="outline" className="text-xs">
                        LiveKit only
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={session.num_participants > 0 ? 'default' : 'secondary'}>
                      {session.num_participants}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(session.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{formatDuration(session.started_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
