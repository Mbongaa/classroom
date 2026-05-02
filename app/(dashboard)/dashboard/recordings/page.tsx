'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useUser } from '@/lib/contexts/UserContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import Link from 'next/link';
import { Play, Download, ArrowUpDown, GraduationCap } from 'lucide-react';
import RecordingDownloadDialog from '@/app/components/RecordingDownloadDialog';
import LearningPageDialog from '@/app/components/LearningPageDialog';

interface SessionRecording {
  id: string;
  status: string;
  hls_playlist_url: string | null;
  mp4_url: string | null;
  duration_seconds: number | null;
  teacher_name: string;
}

interface SessionEntry {
  id: string;
  room_name: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  recording: SessionRecording | null;
}

type SortField = 'room_name' | 'started_at';
type SortOrder = 'asc' | 'desc';

export default function SessionHistoryPage() {
  const { user, profile, loading: userLoading } = useUser();
  const t = useTranslations('recordings');
  const tCommon = useTranslations('common');
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('started_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch('/api/sessions');
        if (!response.ok) throw new Error('Failed to fetch sessions');

        const data = await response.json();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError(err instanceof Error ? err.message : t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchSessions();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getSessionDuration = (session: SessionEntry): number | null => {
    // Prefer recording duration if available
    if (session.recording?.duration_seconds) return session.recording.duration_seconds;
    // Fall back to session started_at / ended_at
    if (session.started_at && session.ended_at) {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.ended_at).getTime();
      if (end > start) return Math.round((end - start) / 1000);
    }
    return null;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let aVal: string = a[sortField];
    let bVal: string = b[sortField];

    if (sortField === 'room_name') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSessions = sortedSessions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getRecordingBadge = (recording: SessionRecording | null) => {
    if (!recording) {
      return (
        <span className="text-xs px-2 py-1 rounded whitespace-nowrap bg-slate-500/20 text-slate-400">
          {t('status.noRecording')}
        </span>
      );
    }

    switch (recording.status) {
      case 'COMPLETED':
        return (
          <span className="text-xs px-2 py-1 rounded whitespace-nowrap bg-green-500/20 text-green-500">
            {t('status.available')}
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="text-xs px-2 py-1 rounded whitespace-nowrap bg-blue-500/20 text-blue-500">
            {t('status.recording')}
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-xs px-2 py-1 rounded whitespace-nowrap bg-red-500/20 text-red-500">
            {t('status.failed')}
          </span>
        );
      default:
        return (
          <span className="text-xs px-2 py-1 rounded whitespace-nowrap bg-yellow-500/20 text-yellow-500">
            {t('status.processing')}
          </span>
        );
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!user || !profile) {
    return <div className="text-black dark:text-white">{tCommon('notAuthenticated')}</div>;
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
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
          {t('title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('room_name')}
                      className="h-8"
                    >
                      {t('table.roomName')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('started_at')}
                      className="h-8"
                    >
                      {t('table.dateTime')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">{t('table.duration')}</TableHead>
                  <TableHead className="text-center">{t('table.recording')}</TableHead>
                  <TableHead className="text-center">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium text-center">
                      {session.room_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center">
                      {new Date(session.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatDuration(getSessionDuration(session))}
                    </TableCell>
                    <TableCell className="text-center">
                      {getRecordingBadge(session.recording)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        {session.recording?.status === 'COMPLETED' && session.recording.hls_playlist_url && (
                          <Button asChild size="sm" variant="default">
                            <Link href={`/dashboard/recordings/${session.recording.id}`}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('table.watch')}
                            </Link>
                          </Button>
                        )}
                        <LearningPageDialog
                          recordingId={session.recording?.status === 'COMPLETED' ? session.recording.id : undefined}
                          sessionId={session.id}
                          roomName={session.room_name}
                          trigger={
                            <Button size="sm" variant="secondary">
                              <GraduationCap className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <RecordingDownloadDialog
                          sessionId={session.id}
                          roomName={session.room_name}
                          recording={
                            session.recording
                              ? {
                                  id: session.recording.id,
                                  room_name: session.room_name,
                                  mp4_url: session.recording.mp4_url,
                                  status: session.recording.status,
                                }
                              : undefined
                          }
                          trigger={
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('pagination.showing', {
                  start: startIndex + 1,
                  end: Math.min(endIndex, sortedSessions.length),
                  total: sortedSessions.length,
                })}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => goToPage(currentPage - 1)}
                      className={
                        currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => goToPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => goToPage(currentPage + 1)}
                      className={
                        currentPage === totalPages
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
