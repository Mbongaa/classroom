'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Classroom } from '@/lib/types';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { RoomFormDialog } from '@/components/rooms/RoomFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import { Settings, Video, RefreshCw, Loader2 } from 'lucide-react';
import { CopyIcon } from '@/components/ui/copy';
import { CheckIcon as AnimatedCheckIcon } from '@/components/ui/check';
import { TrashIcon } from '@/components/ui/trash';

export default function DashboardRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

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
      setError('Failed to fetch rooms. Please try again.');
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

  const handleJoinRoom = (room: Classroom) => {
    if (joiningRoomId) return; // guard against double-click / re-entry
    setJoiningRoomId(room.id);
    let url = `/v2/t/${room.room_code}`;
    if (room.organization_slug) {
      url += `?org=${encodeURIComponent(room.organization_slug)}`;
    }
    router.push(url);
  };

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

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      ar: 'Arabic', en: 'English', fr: 'French', de: 'German',
      es: 'Spanish', nl: 'Dutch', tr: 'Turkish', ur: 'Urdu',
      hi: 'Hindi', 'ar-mixed': 'Arabic Mixed', 'ar-darija': 'Darija',
    };
    return map[code] || code;
  };

  // Map each room type to its branded badge variant so types are visually
  // distinct in the list (meeting=blue, classroom=green, speech=purple).
  const getRoomTypeBadgeVariant = (
    type: string,
  ): 'meeting' | 'classroom' | 'speech' | 'secondary' => {
    if (type === 'meeting' || type === 'classroom' || type === 'speech') {
      return type;
    }
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Manage Classrooms
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage persistent room codes for recurring classes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={fetchRooms} variant="ghost" size="icon" className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <CreateRoomDialog onRoomCreated={handleRoomCreated} />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <PulsatingLoader />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-6">
            <p className="font-medium mb-2">Error loading rooms</p>
            <p className="text-sm">{error}</p>
            <Button onClick={fetchRooms} variant="outline" className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rooms.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 border border-white/20 rounded-lg px-4">
            <h2 className="text-xl font-semibold mb-2">No rooms yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first persistent room to get started. Rooms can be reused for recurring sessions.
            </p>
            <CreateRoomDialog onRoomCreated={handleRoomCreated} />
          </div>
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
                    <Badge
                      variant={getRoomTypeBadgeVariant(room.room_type)}
                      className="text-[11px] px-1.5 py-0"
                    >
                      {room.room_type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px] px-1.5 py-0 border-white/30 text-slate-200"
                    >
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
                  <div className="w-px h-6 bg-white/10 mx-1" />
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
                    onClick={() => handleJoinRoom(room)}
                    disabled={joiningRoomId === room.id}
                    aria-busy={joiningRoomId === room.id}
                  >
                    {joiningRoomId === room.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Joining…
                      </>
                    ) : (
                      'Join Room'
                    )}
                  </Button>
                </div>
              </div>

              {/* Mobile: stacked layout */}
              <div className="flex sm:hidden flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-[15px]">{room.room_code}</span>
                    <Badge
                      variant={getRoomTypeBadgeVariant(room.room_type)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {room.room_type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-white/30 text-slate-200"
                    >
                      {getLanguageLabel(room.settings?.language || 'en')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {room.name}
                    {room.description ? ` — ${room.description}` : ''}
                  </div>
                </div>

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
                      onClick={() => handleJoinRoom(room)}
                      disabled={joiningRoomId === room.id}
                      aria-busy={joiningRoomId === room.id}
                    >
                      {joiningRoomId === room.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Joining…
                        </>
                      ) : (
                        'Join Room'
                      )}
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
