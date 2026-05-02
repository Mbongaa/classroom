import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WelcomeForm } from './welcome-form';

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Set up your organization on Bayaan',
};

/**
 * Post-OAuth onboarding step.
 *
 * Reachable after `signInWithOAuth` finishes and `/auth/callback` finds the
 * user has no organization yet. Collects the org name (and confirms full
 * name) so we can create the organization, link the user as admin, and
 * send them to the dashboard.
 *
 * Guards:
 *   - Unauthenticated -> /login
 *   - Already has organization -> /dashboard
 */
export default async function WelcomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.organization_id) {
    redirect('/dashboard');
  }

  const oauthName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';
  const initialFullName = profile?.full_name || oauthName || '';

  return <WelcomeForm initialFullName={initialFullName} email={user.email ?? ''} />;
}
