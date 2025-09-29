'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PersistentRoom } from '@/lib/types';
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
  room: PersistentRoom;
  onDelete: () => void;
}

export function RoomCard({ room, onDelete }: RoomCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleJoinRoom = () => {
    const { name, metadata } = room;
    let url = `/rooms/${name}`;

    // Add appropriate query parameters based on room type
    if (metadata.roomType === 'classroom') {
      url += '?classroom=true&role=teacher';
    } else if (metadata.roomType === 'speech') {
      url += '?speech=true&role=teacher';
    }

    router.push(url);
  };

  const handleDeleteRoom = async () => {
    if (!confirm(`Are you sure you want to delete room "${room.name}"?`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/rooms/${room.name}`, {
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoomTypeBadgeVariant = () => {
    switch (room.metadata.roomType) {
      case 'meeting':
        return 'meeting';
      case 'classroom':
        return 'classroom';
      case 'speech':
        return 'speech';
      default:
        return 'default';
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-2xl font-bold">{room.name}</CardTitle>
          <Badge variant={getRoomTypeBadgeVariant()}>
            {room.metadata.roomType.charAt(0).toUpperCase() + room.metadata.roomType.slice(1)}
          </Badge>
        </div>
        {room.metadata.description && (
          <CardDescription>{room.metadata.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-grow space-y-2">
        {room.metadata.teacherName && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {room.metadata.roomType === 'classroom' ? 'Teacher' : 'Speaker'}:
            </span>{' '}
            <span className="font-medium">{room.metadata.teacherName}</span>
          </div>
        )}

        {room.metadata.language && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Language:</span>{' '}
            <span>{room.metadata.language}</span>
          </div>
        )}

        <div className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">Created:</span>{' '}
          <span>{formatDate(room.creationTime)}</span>
        </div>

        {room.numParticipants > 0 && (
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">Active participants:</span>{' '}
            <span className="font-medium text-green-500">{room.numParticipants}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          onClick={handleJoinRoom}
          className="flex-1 rounded-full"
          size="sm"
        >
          <Video className="w-4 h-4 mr-2" />
          Join Room
        </Button>
        <Button
          onClick={handleDeleteRoom}
          variant="destructive"
          size="sm"
          disabled={deleting}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}