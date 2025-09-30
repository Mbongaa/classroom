import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Auth Callback Route Handler
 *
 * This route handles OAuth callbacks from authentication providers.
 * When users sign in with a provider (Google, GitHub, etc.), they are
 * redirected back to this endpoint with a code that needs to be exchanged
 * for a session.
 *
 * Flow:
 * 1. Extract the code from the URL
 * 2. Exchange the code for a session using Supabase
 * 3. Redirect to the appropriate page (default: home page)
 *
 * @param request - The incoming request with auth code
 * @returns Redirect response
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // If there's a 'next' parameter, redirect there after auth
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // In local development, redirect to localhost
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // In production with a forwarding proxy, use the forwarded host
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}