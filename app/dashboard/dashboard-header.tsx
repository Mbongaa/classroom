import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function DashboardHeader() {
  return (
    <header className="border-b border-[rgba(128,128,128,0.3)] bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        {/* LEFT: Hamburger menu (mobile only) + Logo */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            bayaan.ai
          </span>
        </div>

        {/* RIGHT: Theme toggle */}
        <ThemeToggleButton start="top-right" />
      </div>
    </header>
  );
}
