import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DashboardModeToggle } from '@/components/dashboard-mode-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';

interface DashboardHeaderProps {
  /** Org slug for the finance route. Null = user has no primary org yet. */
  orgSlug: string | null;
  /** Whether the current user can enter finance surfaces for this org. */
  canAccessFinance?: boolean;
  /**
   * Render the sidebar hamburger on the left. Only valid when the page is
   * wrapped in a SidebarProvider.
   */
  showSidebarTrigger?: boolean;
}

export function DashboardHeader({
  orgSlug,
  canAccessFinance = false,
  showSidebarTrigger = false,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-[rgba(128,128,128,0.3)] bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        {/* LEFT: Hamburger menu (mobile only) + Logo */}
        <div className="flex items-center gap-4">
          {showSidebarTrigger && <SidebarTrigger className="md:hidden" />}
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            bayaan.ai
          </span>
        </div>

        {/* CENTER: Dashboard mode toggle */}
        <DashboardModeToggle orgSlug={orgSlug} canAccessFinance={canAccessFinance} />

        {/* RIGHT: Language + Theme toggle */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggleButton start="top-right" />
        </div>
      </div>
    </header>
  );
}
