import { MarketingLandingPage } from '@/components/marketing/LandingPage';

/**
 * Landing Page
 *
 * Shows marketing page for unauthenticated users.
 * Authenticated users are automatically redirected to /dashboard by middleware.
 */
export default function Page() {
  return <MarketingLandingPage />;
}
