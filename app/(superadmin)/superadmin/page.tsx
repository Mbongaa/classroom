'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IconBuilding, IconUsers, IconSchool, IconVideo } from '@tabler/icons-react';

interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalClassrooms: number;
  activeSessions: number;
}

export default function SuperadminOverviewPage() {
  const { profile, loading: userLoading } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && (!profile || !profile.is_superadmin)) {
      router.replace('/dashboard');
      return;
    }
  }, [profile, userLoading, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/superadmin/stats');
        if (!res.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (profile?.is_superadmin) {
      fetchStats();
    }
  }, [profile]);

  if (userLoading || !profile?.is_superadmin) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations,
      icon: IconBuilding,
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers,
      icon: IconUsers,
    },
    {
      title: 'Total Classrooms',
      value: stats?.totalClassrooms,
      icon: IconSchool,
    },
    {
      title: 'Active Sessions',
      value: stats?.activeSessions,
      icon: IconVideo,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground">Monitor platform-wide metrics and activity.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{card.value ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
