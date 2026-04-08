import { DashboardHeader } from '@/app/dashboard/dashboard-header';

/**
 * /mosque-admin/[slug] layout
 *
 * Wraps the finance dashboard (and its settings sub-route) in the shared
 * DashboardHeader so the translation ↔ finance toggle lives in the exact
 * same place on both sides. No sidebar on this side — the finance dashboard
 * is a single-page view, not a tree of sub-pages like the classroom side.
 */

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function MosqueAdminLayout({ children, params }: LayoutProps) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <DashboardHeader currentMode="finance" orgSlug={slug} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
