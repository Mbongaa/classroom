'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/UserContext';
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
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown } from 'lucide-react';

interface SessionEntry {
  id: string | null;
  room_name: string;
  session_id: string | null;
  started_at: string;
  ended_at: string | null;
  organization: string | null;
}

type SortField = 'room_name' | 'organization' | 'started_at' | 'status';
type SortOrder = 'asc' | 'desc';

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  pages.push(1);
  if (currentPage > 3) pages.push('ellipsis');
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);
  return pages;
}

export default function SuperadminSessionsPage() {
  const { profile, loading: userLoading } = useUser();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'status' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    // Status sort: active (ended_at=null) always first when asc
    if (sortField === 'status') {
      const aActive = a.ended_at === null ? 0 : 1;
      const bActive = b.ended_at === null ? 0 : 1;
      if (aActive !== bActive) return sortOrder === 'asc' ? aActive - bActive : bActive - aActive;
      // Secondary sort: most recent first
      return b.started_at.localeCompare(a.started_at);
    }

    let aVal = '';
    let bVal = '';

    if (sortField === 'organization') {
      aVal = (a.organization ?? '').toLowerCase();
      bVal = (b.organization ?? '').toLowerCase();
    } else if (sortField === 'room_name') {
      aVal = a.room_name.toLowerCase();
      bVal = b.room_name.toLowerCase();
    } else {
      aVal = a.started_at;
      bVal = b.started_at;
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

  if (userLoading || !profile?.is_superadmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Sessions</h1>
          <p className="text-slate-500 dark:text-slate-400">
            All sessions across the platform. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(128,128,128,0.3)] bg-white dark:bg-black text-black dark:text-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('status')}
                  className="h-8"
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
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
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('organization')}
                  className="h-8"
                >
                  Organization
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
                  Started At
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No sessions found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedSessions.map((session, idx) => (
                <TableRow
                  key={session.id ?? `live-${idx}`}
                  className={session.ended_at === null ? 'bg-green-500/10 hover:bg-green-500/15' : ''}
                >
                  <TableCell className="text-center">
                    {session.ended_at === null ? (
                      <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ended</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-center">{session.room_name}</TableCell>
                  <TableCell className="text-center">
                    {session.organization ? (
                      <Badge variant="outline">{session.organization}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unlinked</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center whitespace-nowrap">
                    {new Date(session.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDuration(session.started_at, session.ended_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedSessions.length)} of{' '}
            {sortedSessions.length} sessions
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
              {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                page === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => goToPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
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
    </div>
  );
}
