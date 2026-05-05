'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Classroom } from '@/lib/types';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { RoomFormDialog } from '@/components/rooms/RoomFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PulsatingLoader from '@/components/ui/pulsating-loader';
import { Settings, RefreshCw, Loader2, KeyRound } from 'lucide-react';
import { CopyIcon } from '@/components/ui/copy';
import { CheckIcon as AnimatedCheckIcon } from '@/components/ui/check';
import { TrashIcon } from '@/components/ui/trash';

export default function DashboardRoomsPage() {
  const router = useRouter();
  const t = useTranslations('rooms');
  const tLang = useTranslations('languages');
  const tCommon = useTranslations('common');
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [copiedHostRoomId, setCopiedHostRoomId] = useState<string | null>(null);
  const [copyingHostRoomId, setCopyingHostRoomId] = useState<string | null>(null);
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
        setError(data.error || t('errors.fetchFailed'));
        setLoading(false);
        return;
      }

      setRooms(data.classrooms || []);
    } catch {
      setError(t('errors.fetchRetry'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  const handleCopyHostLink = async (room: Classroom) => {
    if (!confirm(t('actions.copyHostWarning'))) return;

    setCopyingHostRoomId(room.id);
    try {
      const response = await fetch(`/api/classrooms/${room.room_code}/host-link`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.hostUrl) {
        throw new Error(data.error || t('errors.hostLinkFailed'));
      }

      await navigator.clipboard.writeText(data.hostUrl);
      setCopiedHostRoomId(room.id);
      setTimeout(() => setCopiedHostRoomId(null), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : t('errors.hostLinkFailed'));
    } finally {
      setCopyingHostRoomId(null);
    }
  };

  const handleDeleteRoom = async (room: Classroom) => {
    if (!confirm(t('errors.deleteConfirm', { code: room.room_code }))) return;
    try {
      const response = await fetch(`/api/classrooms/${room.room_code}`, { method: 'DELETE' });
      if (response.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== room.id));
      } else {
        const data = await response.json();
        alert(data.error || t('errors.deleteFailed'));
      }
    } catch {
      alert(t('errors.deleteFailed'));
    }
  };

  const getLanguageLabel = (code: string) => {
    const knownKeys = ['ar', 'en', 'fr', 'de', 'es', 'nl', 'tr', 'ur', 'hi', 'ar-mixed', 'ar-darija'];
    return knownKeys.includes(code) ? tLang(code) : code;
  };

  const getRoomTypeBadgeVariant = (
    type: string,
  ): 'meeting' | 'classroom' | 'speech' | 'secondary' => {
    if (type === 'meeting' || type === 'classroom' || type === 'speech') {
      return type;
    }
    return 'secondary';
  };

  const getRoomTypeLabel = (type: string) => {
    if (type === 'meeting' || type === 'classroom' || type === 'speech') {
      return t(`types.${type}`);
    }
    return type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
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
            <p className="font-medium mb-2">{t('errors.loadTitle')}</p>
            <p className="text-sm">{error}</p>
            <Button onClick={fetchRooms} variant="outline" className="mt-4">
              {tCommon('tryAgain')}
            </Button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rooms.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 border border-white/20 rounded-lg px-4">
            <h2 className="text-xl font-semibold mb-2">{t('empty.title')}</h2>
            <p className="text-muted-foreground mb-6">{t('empty.subtitle')}</p>
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
                      {getRoomTypeLabel(room.room_type)}
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
                    title={t('actions.copyStudentLink')}
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
                        {t('actions.joining')}
                      </>
                    ) : (
                      t('actions.joinRoom')
                    )}
                  </Button>
                  <div className="w-px h-6 bg-amber-400/30 mx-2" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-400/50 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                    title={t('actions.copyHostLink')}
                    onClick={() => handleCopyHostLink(room)}
                    disabled={copyingHostRoomId === room.id}
                    aria-busy={copyingHostRoomId === room.id}
                  >
                    {copyingHostRoomId === room.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : copiedHostRoomId === room.id ? (
                      <AnimatedCheckIcon size={14} className="mr-1.5 text-green-500" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t('actions.copyHostLink')}
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
                      {getRoomTypeLabel(room.room_type)}
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
                      title={t('actions.copyStudentLink')}
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
                          {t('actions.joining')}
                        </>
                      ) : (
                        t('actions.joinRoom')
                      )}
                    </Button>
                  </div>
                </div>
                <div className="border-t border-amber-400/20 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-center text-xs border-amber-400/50 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                    title={t('actions.copyHostLink')}
                    onClick={() => handleCopyHostLink(room)}
                    disabled={copyingHostRoomId === room.id}
                    aria-busy={copyingHostRoomId === room.id}
                  >
                    {copyingHostRoomId === room.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : copiedHostRoomId === room.id ? (
                      <AnimatedCheckIcon size={14} className="mr-1.5 text-green-500" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t('actions.copyHostLink')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
