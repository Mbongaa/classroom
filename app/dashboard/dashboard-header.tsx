import { ThemeToggleButton } from '@/components/ui/theme-toggle';

export function DashboardHeader() {
  return (
    <header className="border-b border-[rgba(128,128,128,0.3)] bg-background">
      <div className="flex h-16 items-center justify-end px-6">
        <ThemeToggleButton start="top-right" />
      </div>
    </header>
  );
}