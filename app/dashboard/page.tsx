'use client';

import { useUser } from '@/lib/contexts/UserContext';
import { useEffect, useState } from 'react';
import { DashboardContent } from './DashboardContent';
import { createClient } from '@/lib/supabase/client';
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
      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Get classrooms (full data for display + count)
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(3); // Show only 3 most recent rooms

      // Get recording count
      const { count: recordingCount } = await supabase
        .from('session_recordings')
        .select('*', { count: 'exact', head: true })
        .in('classroom_id', classrooms?.map((c) => c.id) || []);

      setStats({
        classroomCount: classrooms?.length || 0,
        recordingCount: recordingCount || 0,
      });
      setRooms(classrooms || []);
      setLoading(false);
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
      rooms={rooms}
    />
  );
}
