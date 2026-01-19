'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateRoomId } from '@/lib/client-utils';
import { Classroom } from '@/lib/types';
import { Video, ArrowRight } from 'lucide-react';

interface DashboardContentProps {
  userName: string;
  classroomCount: number;
  recordingCount: number;
  organizationName: string;
  rooms: Classroom[];
}

export function DashboardContent({
  userName,
  classroomCount,
  recordingCount,
  organizationName,
  rooms,
}: DashboardContentProps) {
  const router = useRouter();

  // Handler functions
  const startClassroom = () => {
    const roomId = generateRoomId();
    router.push(`/rooms/${roomId}?classroom=true&role=teacher`);
  };

  const startSpeechSession = () => {
    const roomId = generateRoomId();
    router.push(`/rooms/${roomId}?speech=true&role=teacher`);
  };

  const stats = [
    {
      title: 'Active Classrooms',
      value: classroomCount || 0,
      description: 'Live and scheduled classes',
      link: '/dashboard/classrooms',
    },
    {
      title: 'Recordings',
      value: recordingCount || 0,
      description: 'Saved session recordings',
      link: '/dashboard/recordings',
    },
    {
      title: 'Organization',
      value: organizationName || 'N/A',
      description: 'Your organization',
      link: '/dashboard/organization',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
          Welcome back, {userName}!
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Here&apos;s what&apos;s happening with your classrooms today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black dark:text-white">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.link && (
                <Link href={stat.link}>
                  <Button variant="link" className="px-0 mt-2" size="sm">
                    View all →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start or join a session instantly</CardDescription>
          </CardHeader>
          <CardContent>
            {/* EXACT original styling from homepage */}
            <p className="text-black dark:text-white" style={{ margin: '0 0 1rem 0' }}>
              Start or join a video conference session.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              {/* Start Classroom */}
              <button
                onClick={startClassroom}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
              >
                Start Classroom
              </button>

              {/* Start Speech Session */}
              <button
                onClick={startSpeechSession}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
              >
                Start Speech Session
              </button>

              {/* Divider */}
              <div
                style={{
                  width: '100%',
                  height: '1px',
                  background: 'rgba(128, 128, 128, 0.3)',
                  margin: '0.5rem 0',
                }}
              />

              {/* Manage Persistent Rooms */}
              <button
                onClick={() => router.push('/dashboard/rooms')}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
              >
                Manage Persistent Rooms
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Rooms</CardTitle>
                <CardDescription>Your most recently created classrooms</CardDescription>
              </div>
              <Link href="/dashboard/rooms">
                <Button variant="ghost" size="sm" className="gap-1">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No rooms created yet
                </p>
                <Link href="/dashboard/rooms">
                  <Button size="sm">Create your first room</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      let url = `/rooms/${room.room_code}`;
                      if (room.room_type === 'classroom') {
                        url += '?classroom=true&role=teacher';
                      } else if (room.room_type === 'speech') {
                        url += '?speech=true&role=teacher';
                      }
                      router.push(url);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-black dark:text-white truncate">
                          {room.room_code}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {room.room_type === 'classroom'
                            ? 'Classroom'
                            : room.room_type === 'speech'
                              ? 'Speech'
                              : 'Meeting'}
                        </Badge>
                      </div>
                      {room.name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {room.name}
                        </p>
                      )}
                    </div>
                    <Video className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
