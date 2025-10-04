'use client';

import { useEffect, useState } from 'react';
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
import { Play, Download, Trash2, Clock, Calendar, ArrowUpDown } from 'lucide-react';
import RecordingDownloadDialog from '@/app/components/RecordingDownloadDialog';

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

type SortField = 'room_name' | 'started_at' | 'duration_seconds';
type SortOrder = 'asc' | 'desc';

export default function RecordingsPage() {
  const { user, profile, loading: userLoading } = useUser();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('started_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Sort recordings
  const sortedRecordings = [...recordings].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    // Handle null values
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // String comparison for room_name
    if (sortField === 'room_name') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedRecordings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecordings = sortedRecordings.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
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
        <>
          <div className="rounded-lg border border-[rgba(128,128,128,0.3)] bg-white dark:bg-black text-black dark:text-white shadow-sm">
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
                      Room Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Teacher</TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('started_at')}
                      className="h-8"
                    >
                      Date & Time
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('duration_seconds')}
                      className="h-8"
                    >
                      Duration
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center pr-2">Status</TableHead>
                  <TableHead className="text-center pl-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecordings.map((recording) => (
                  <TableRow key={recording.id}>
                    <TableCell className="font-medium text-center">{recording.room_name}</TableCell>
                    <TableCell className="text-center">{recording.teacher_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-center">
                      {new Date(recording.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">{formatDuration(recording.duration_seconds)}</TableCell>
                    <TableCell className="text-center pr-2">
                      <span
                        className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                          recording.status === 'COMPLETED'
                            ? 'bg-green-500/20 text-green-500'
                            : recording.status === 'ACTIVE'
                            ? 'bg-blue-500/20 text-blue-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}
                      >
                        {recording.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center pl-2">
                      {recording.status === 'COMPLETED' && recording.hls_playlist_url ? (
                        <div className="flex gap-2 justify-center">
                          <Button asChild size="sm" variant="default">
                            <Link href={`/dashboard/recordings/${recording.id}`}>
                              <Play className="h-4 w-4 mr-2" />
                              Watch
                            </Link>
                          </Button>
                          <RecordingDownloadDialog
                            recording={recording}
                            trigger={
                              <Button size="sm" variant="outline">
                                <Download className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(recording.id, recording.room_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {recording.status === 'ACTIVE'
                            ? 'Recording...'
                            : recording.status === 'FAILED'
                            ? 'Failed'
                            : 'Processing...'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedRecordings.length)} of{' '}
                {sortedRecordings.length} recordings
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
