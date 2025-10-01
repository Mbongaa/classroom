'use client';

import { useUser } from '@/lib/contexts/UserContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function RecordingsPage() {
  const { user, profile, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulsatingLoader />
      </div>
    );
  }

  if (!user || !profile) {
    return <div>Not authenticated</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recordings</h1>
        <p className="text-muted-foreground">Manage and view your session recordings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Recordings</CardTitle>
          <CardDescription>Access and manage your recorded classroom sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">Recording features coming soon!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ll be able to view, download, and share your classroom recordings here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
