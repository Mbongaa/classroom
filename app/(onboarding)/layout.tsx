/**
 * (onboarding) route group layout.
 *
 * Renders a full-height, scrollable container that bypasses the dashboard
 * chrome (no sidebar, no header). Sets its own scroll context because the
 * global stylesheet pins `overflow: hidden` on <html>/<body> for the
 * LiveKit classroom views.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-screen w-screen overflow-y-auto bg-white dark:bg-black"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  );
}
