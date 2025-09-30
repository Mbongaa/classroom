'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateRoomId, randomString, encodePassphrase } from '@/lib/client-utils';

interface DashboardContentProps {
  userName: string;
  classroomCount: number;
  recordingCount: number;
  organizationName: string;
}

export function DashboardContent({
  userName,
  classroomCount,
  recordingCount,
  organizationName,
}: DashboardContentProps) {
  const router = useRouter();

  // State for E2EE
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  // Handler functions
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

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
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {userName}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your classrooms today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              {/* Start Meeting */}
              <button
                onClick={startMeeting}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
              >
                Start Meeting
              </button>

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
              <div style={{ width: '100%', height: '1px', background: 'rgba(128, 128, 128, 0.3)', margin: '0.5rem 0' }} />

              {/* Manage Persistent Rooms */}
              <button
                onClick={() => router.push('/dashboard/rooms')}
                className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
              >
                Manage Persistent Rooms
              </button>
            </div>

            {/* E2EE Section - EXACT original */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
                <input
                  id="use-e2ee"
                  type="checkbox"
                  checked={e2ee}
                  onChange={(ev) => setE2ee(ev.target.checked)}
                />
                <label htmlFor="use-e2ee" className="text-black dark:text-white">
                  Enable end-to-end encryption
                </label>
              </div>
              {e2ee && (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
                  <label htmlFor="passphrase" className="text-black dark:text-white">Passphrase</label>
                  <input
                    id="passphrase"
                    type="password"
                    value={sharedPassphrase}
                    onChange={(ev) => setSharedPassphrase(ev.target.value)}
                    className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-transparent text-black dark:text-white"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Learn how to use Bayaan Classroom</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <p className="font-medium">1. Create a classroom</p>
              <p className="text-muted-foreground">Set up a recurring room code</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">2. Share with students</p>
              <p className="text-muted-foreground">Send them the room link</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">3. Start teaching</p>
              <p className="text-muted-foreground">Go live with real-time translation</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}