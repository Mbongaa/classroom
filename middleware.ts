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
 * Subdomain routing:
 *   `{orgSlug}.bayaan.app/donate/...` rewrites transparently to
 *   `/donate/{orgSlug}/...` so the existing donate routes serve the
 *   content. The rewritten URL is never visible to the visitor.
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

/**
 * Matches org subdomains on bayaan.app (e.g. "elfeth.bayaan.app").
 * Excludes "www" so the main site keeps its normal routing.
 */
const SUBDOMAIN_RE = /^([a-z0-9][a-z0-9-]{0,58}[a-z0-9])\.bayaan\.app$/;

export async function middleware(request: NextRequest) {
  // ---- Subdomain → /donate rewrite ------------------------------------
  const host = request.headers.get('host')?.toLowerCase() || '';
  const subdomainMatch = host.match(SUBDOMAIN_RE);

  if (subdomainMatch && subdomainMatch[1] !== 'www') {
    const orgSlug = subdomainMatch[1];
    const pathname = request.nextUrl.pathname;

    // Root of the subdomain → redirect to /donate
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/donate';
      return NextResponse.redirect(url);
    }

    // /donate or /donate/... → rewrite to /donate/{orgSlug}/...
    if (pathname === '/donate' || pathname.startsWith('/donate/')) {
      const rest = pathname.replace(/^\/donate/, '');
      const url = request.nextUrl.clone();
      url.pathname = `/donate/${orgSlug}${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  // ---- Default: Supabase session management ---------------------------
  return updateSession(request);
}

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
