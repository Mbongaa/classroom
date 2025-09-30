'use client';

import { useUser } from '@/lib/contexts/UserContext';
import { useEffect, useState } from 'react';
import { DashboardContent } from './DashboardContent';
import { createClient } from '@/lib/supabase/client';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function DashboardPage() {
  const { user, profile, loading: userLoading } = useUser();
  const [stats, setStats] = useState({
    classroomCount: 0,
    recordingCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Get classroom count
      const { count: classroomCount } = await supabase
        .from('classrooms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);

      // Get classrooms for recording count
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('id')
        .eq('organization_id', profile.organization_id);

      // Get recording count
      const { count: recordingCount } = await supabase
        .from('session_recordings')
        .select('*', { count: 'exact', head: true })
        .in('classroom_id', classrooms?.map(c => c.id) || []);

      setStats({
        classroomCount: classroomCount || 0,
        recordingCount: recordingCount || 0,
      });
      setLoading(false);
    }

    fetchStats();
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
    />
  );
}