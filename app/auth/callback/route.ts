import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth callback for social sign-in (Google, etc).
 *
 * Supabase redirects here with `?code=...` after the provider sign-in. We
 * exchange the code for a session, then route based on whether the user has
 * already completed onboarding (organization membership):
 *
 *   - Superadmin               -> /superadmin
 *   - Has organization         -> /dashboard (or `?next=` if provided)
 *   - Brand new user (no org)  -> /welcome  (onboarding form)
 *
 * Errors land on /auth/auth-code-error with a humanized reason.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    const url = new URL('/auth/auth-code-error', origin);
    url.searchParams.set('reason', errorDescription);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL('/auth/auth-code-error', origin);
    url.searchParams.set('reason', 'missing_params');
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const url = new URL('/auth/auth-code-error', origin);
    url.searchParams.set('reason', error?.message ?? 'exchange_failed');
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, is_superadmin')
    .eq('id', data.user.id)
    .single();

  if (profile?.is_superadmin) {
    return NextResponse.redirect(new URL('/superadmin', origin));
  }

  if (!profile?.organization_id) {
    return NextResponse.redirect(new URL('/welcome', origin));
  }

  const dest = next && next.startsWith('/') ? next : '/dashboard';
  return NextResponse.redirect(new URL(dest, origin));
}
