'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Classroom } from '@/lib/types';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { RoomFormDialog } from '@/components/rooms/RoomFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import { Settings, Video, RefreshCw } from 'lucide-react';
import { CopyIcon } from '@/components/ui/copy';
import { CheckIcon as AnimatedCheckIcon } from '@/components/ui/check';
import { TrashIcon } from '@/components/ui/trash';

export default function V2RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/classrooms', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch classrooms');
        setLoading(false);
        return;
      }

      setRooms(data.classrooms || []);
    } catch {
      setError('Failed to fetch rooms. Are you logged in?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleRoomCreated = (newRoom?: Classroom) => {
    if (newRoom) {
      setRooms((prev) => [newRoom, ...prev]);
    } else {
      fetchRooms();
    }
  };

  const handleRoomUpdated = (updatedRoom: Classroom) => {
    setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
  };

  const handleJoinRoom = (room: Classroom, role: 'teacher' | 'student') => {
    const prefix = role === 'teacher' ? '/v2/t/' : '/v2/s/';
    let url = `${prefix}${room.room_code}`;
    if (room.organization_slug) {
      url += `?org=${encodeURIComponent(room.organization_slug)}`;
    }
    router.push(url);
  };

  const handleDeleteRoom = async (room: Classroom) => {
    if (!confirm(`Are you sure you want to delete "${room.room_code}"?`)) return;
    try {
      const response = await fetch(`/api/classrooms/${room.room_code}`, { method: 'DELETE' });
      if (response.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== room.id));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete room');
      }
    } catch {
      alert('Failed to delete room');
    }
  };

  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const buildStudentLink = (room: Classroom) => {
    const prefix = room.room_type === 'speech' ? '/v2/speech-s/' : '/v2/s/';
    let url = `${window.location.origin}${prefix}${room.room_code}`;
    if (room.organization_slug) {
      url += `?org=${encodeURIComponent(room.organization_slug)}`;
    }
    return url;
  };

  const handleCopyStudentLink = async (room: Classroom) => {
    const link = buildStudentLink(room);
    await navigator.clipboard.writeText(link);
    setCopiedRoomId(room.id);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      ar: 'Arabic', en: 'English', fr: 'French', de: 'German',
      es: 'Spanish', nl: 'Dutch', tr: 'Turkish', ur: 'Urdu',
      hi: 'Hindi', 'ar-mixed': 'Arabic Mixed', 'ar-darija': 'Darija',
    };
    return map[code] || code;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Classrooms</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Manage rooms with v2 session management
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button onClick={fetchRooms} variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <CreateRoomDialog onRoomCreated={handleRoomCreated} />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <PulsatingLoader />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-8 sm:py-10 text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4 sm:p-6">
          <p className="font-medium mb-1">Error loading rooms</p>
          <p className="text-sm">{error}</p>
          <Button onClick={fetchRooms} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rooms.length === 0 && (
        <div className="text-center py-12 sm:py-16 border border-border/40 rounded-lg bg-card px-4">
          <h2 className="text-lg font-semibold mb-2">No rooms yet</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Create your first room to get started.
          </p>
          <CreateRoomDialog onRoomCreated={handleRoomCreated} />
        </div>
      )}

      {/* Room list */}
      {!loading && !error && rooms.length > 0 && (
        <div className="flex flex-col gap-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="border border-white/20 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 hover:border-white/30 transition-colors"
            >
              {/* Desktop: single row */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{room.room_code}</span>
                    <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                      {room.room_type}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                      {getLanguageLabel(room.settings?.language || 'en')}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {room.name}
                    {room.description ? ` — ${room.description}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <RoomFormDialog
                    mode="edit"
                    room={room}
                    onSuccess={handleRoomUpdated}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => handleDeleteRoom(room)}
                  >
                    <TrashIcon size={14} />
                  </Button>
                  <div className="w-px h-6 bg-border/40 mx-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Copy student link"
                    onClick={() => handleCopyStudentLink(room)}
                  >
                    {copiedRoomId === room.id ? (
                      <AnimatedCheckIcon size={14} className="text-green-500" />
                    ) : (
                      <CopyIcon size={14} />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => handleJoinRoom(room, 'teacher')}
                  >
                    Join Room
                  </Button>
                </div>
              </div>

              {/* Mobile: stacked layout */}
              <div className="flex sm:hidden flex-col gap-3">
                {/* Top: room info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-[15px]">{room.room_code}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {room.room_type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {getLanguageLabel(room.settings?.language || 'en')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {room.name}
                    {room.description ? ` — ${room.description}` : ''}
                  </div>
                </div>

                {/* Bottom: actions row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <RoomFormDialog
                      mode="edit"
                      room={room}
                      onSuccess={handleRoomUpdated}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => handleDeleteRoom(room)}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copy student link"
                      onClick={() => handleCopyStudentLink(room)}
                    >
                      {copiedRoomId === room.id ? (
                        <AnimatedCheckIcon size={14} className="text-green-500" />
                      ) : (
                        <CopyIcon size={14} />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleJoinRoom(room, 'teacher')}
                    >
                      Join Room
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
