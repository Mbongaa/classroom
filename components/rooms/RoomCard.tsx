'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Classroom } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Trash2, Video } from 'lucide-react';

interface RoomCardProps {
  room: Classroom;
  onDelete: () => void;
}

export function RoomCard({ room, onDelete }: RoomCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleJoinRoom = () => {
    const { room_code, room_type } = room;

    // ✅ FIX: Generate URL based on actual room type
    let url = `/rooms/${room_code}`;

    // Add mode-specific query params
    if (room_type === 'classroom') {
      url += '?classroom=true&role=teacher';
    } else if (room_type === 'speech') {
      url += '?speech=true&role=teacher';
    } else {
      // 'meeting' type - no special params needed
      url += '?role=teacher';
    }

    router.push(url);
  };

  const handleDeleteRoom = async () => {
    if (!confirm(`Are you sure you want to delete classroom "${room.room_code}"?`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/classrooms/${room.room_code}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(`Failed to delete room: ${data.error}`);
        setDeleting(false);
        return;
      }

      onDelete();
    } catch (error) {
      alert('Failed to delete room. Please try again.');
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-2xl font-bold">{room.room_code}</CardTitle>
          <Badge variant={room.room_type}>
            {room.room_type === 'classroom'
              ? 'Classroom'
              : room.room_type === 'speech'
                ? 'Speech'
                : 'Meeting'}
          </Badge>
        </div>
        {room.description && <CardDescription>{room.description}</CardDescription>}
      </CardHeader>

      <CardContent className="flex-grow space-y-2">
        {room.name && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Teacher:</span>{' '}
            <span className="font-medium">{room.name}</span>
          </div>
        )}

        {room.settings.language && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Language:</span>{' '}
            <span>{room.settings.language}</span>
          </div>
        )}

        <div className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">Created:</span>{' '}
          <span>{formatDate(room.created_at)}</span>
        </div>

        {room.isLive && room.numParticipants !== undefined && room.numParticipants > 0 && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Active participants:</span>{' '}
            <span className="font-medium text-green-500">{room.numParticipants}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button onClick={handleJoinRoom} className="flex-1 rounded-full border dark:border-white/50" size="sm">
          <Video className="w-4 h-4 mr-2" />
          Join Room
        </Button>
        <Button onClick={handleDeleteRoom} variant="destructive" size="sm" disabled={deleting}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
