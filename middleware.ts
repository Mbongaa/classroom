import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js Middleware for Supabase Session Management and App Shell Support
 *
 * This middleware runs on every request and ensures that:
 * 1. User sessions are kept alive and refreshed
 * 2. Session cookies are properly managed
 * 3. Authentication state is maintained across requests
 * 4. Pathname is available in server components for app shell rendering
 *
 * The middleware is configured to run on all routes except:
 * - Static files (_next/static)
 * - Image optimization files (_next/image)
 * - Favicon
 * - Common static assets (svg, png, jpg, jpeg, gif, webp)
 *
 * To add authentication protection (redirecting unauthenticated users),
 * uncomment the logic in lib/supabase/middleware.ts
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Force Node.js runtime for Supabase compatibility (uses Node.js APIs)
export const runtime = 'nodejs';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
