'use client';

import { useUser } from '@/lib/contexts/UserContext';
import { useEffect, useState } from 'react';
import { DashboardContent } from './DashboardContent';
import { Classroom } from '@/lib/types';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function DashboardPage() {
  const { user, profile, loading: userLoading } = useUser();
  const [stats, setStats] = useState({
    classroomCount: 0,
    recordingCount: 0,
  });
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!profile) {
        setLoading(false);
        return;
      }

      // Use the same API routes the rest of the dashboard uses. They go
      // through `requireTeacher`/`requireAuth` which honor superadmin
      // impersonation, so this page automatically reflects the impersonated
      // org without needing a separate code path.
      try {
        const [classroomsRes, sessionsRes] = await Promise.all([
          fetch('/api/classrooms'),
          fetch('/api/sessions'),
        ]);

        const classrooms: Classroom[] = classroomsRes.ok
          ? ((await classroomsRes.json()).classrooms ?? [])
          : [];
        const sessions: { recording: unknown }[] = sessionsRes.ok
          ? ((await sessionsRes.json()).sessions ?? [])
          : [];

        const recordingCount = sessions.filter((s) => s.recording !== null).length;

        setStats({
          classroomCount: classrooms.length,
          recordingCount,
        });
        // Show 3 most recent rooms (API already orders by created_at desc).
        setRooms(classrooms.slice(0, 3));
      } catch (err) {
        console.error('[Dashboard] Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <DashboardContent
      userName={profile.full_name || ''}
      classroomCount={stats.classroomCount}
      recordingCount={stats.recordingCount}
      organizationName={profile.organization?.name || 'N/A'}
      organizationSlug={profile.organization?.slug || ''}
      rooms={rooms}
    />
  );
}
