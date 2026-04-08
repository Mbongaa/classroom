import { NextRequest, NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Email link confirmation handler.
 *
 * Receives clicks on the links inside transactional auth emails sent via
 * the Send Email Hook (/api/auth/email-hook). Calls verifyOtp() to exchange
 * the token_hash for a session, then redirects the user.
 *
 * Expected query params:
 *   token_hash: string  — Supabase-generated PKCE token
 *   type: EmailOtpType  — 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite'
 *   next: string        — where to send the user after successful verification
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=missing_params`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('[/api/auth/confirm] verifyOtp failed:', error.message);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`,
    );
  }

  // Honor x-forwarded-host when behind a proxy (Vercel, etc.) so the redirect
  // matches the host the user actually came from.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  // Only allow same-origin redirects (`next` must be a relative path)
  // to prevent open-redirect abuse via the email link query string.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }
  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
