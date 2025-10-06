'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Classroom } from '@/lib/types';
import { CreateRoomDialog } from '@/components/rooms/CreateRoomDialog';
import { RoomCard } from '@/components/rooms/RoomCard';
import { Button } from '@/components/ui/button';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function DashboardRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/classrooms');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch classrooms');
        setLoading(false);
        return;
      }

      setRooms(data.classrooms || []);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
            Manage Classrooms
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Create and manage persistent room codes for recurring classes
          </p>
        </div>
        <CreateRoomDialog onRoomCreated={fetchRooms} />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <PulsatingLoader />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-6">
            <p className="font-medium mb-2">Error loading rooms</p>
            <p className="text-sm">{error}</p>
            <Button onClick={fetchRooms} variant="outline" className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && rooms.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-12 border border-border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-2 text-black dark:text-white">No rooms yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first persistent room to get started. Rooms can be reused for recurring
              sessions.
            </p>
            <CreateRoomDialog onRoomCreated={fetchRooms} />
          </div>
        </div>
      )}

      {/* Rooms Grid */}
      {!loading && !error && rooms.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-slate-500 dark:text-slate-400">
              {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} available
            </p>
            <Button
              onClick={fetchRooms}
              variant="outline"
              size="sm"
              className="text-black dark:text-white"
            >
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onDelete={fetchRooms} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
