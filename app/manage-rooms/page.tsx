'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PersistentRoom } from '@/lib/types';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { RoomCard } from '@/components/rooms/RoomCard';
import { Button } from '@/components/ui/button';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ManageRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<PersistentRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch rooms');
        setLoading(false);
        return;
      }

      setRooms(data.rooms || []);
    } catch (err) {
      setError('Failed to fetch rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b border-[rgba(128,128,128,0.3)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              Manage Persistent Rooms
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <CreateRoomDialog onRoomCreated={fetchRooms} />
            <ThemeToggleButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-12 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-6">
              <p className="font-medium mb-2">Error loading rooms</p>
              <p className="text-sm">{error}</p>
              <Button
                onClick={fetchRooms}
                variant="outline"
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && rooms.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-12 border border-[rgba(128,128,128,0.3)] rounded-lg">
              <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
                No rooms yet
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Create your first persistent room to get started. Rooms can be reused for recurring sessions.
              </p>
              <CreateRoomDialog onRoomCreated={fetchRooms} />
            </div>
          </div>
        )}

        {/* Rooms Grid */}
        {!loading && !error && rooms.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-slate-500 dark:text-slate-400">
                {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} available
              </p>
              <Button
                onClick={fetchRooms}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <RoomCard
                  key={room.sid}
                  room={room}
                  onDelete={fetchRooms}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}