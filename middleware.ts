import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Inlined here (rather than imported from `@/i18n/config`) so the edge
// middleware bundle stays minimal and doesn't trip the Next.js Turbopack
// "Cannot redefine property: __import_unsupported" runtime error from
// pulling app code into the edge runtime. Must stay in sync with
// `i18n/config.ts`.
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

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
 * Two-domain routing (bayaan.ai + bayaan.app):
 *   The marketing landing (and only the landing) lives at bayaan.ai. Every
 *   product surface — auth, dashboard, classrooms, donate, manage rooms,
 *   superadmin — lives at bayaan.app. The middleware redirects between the
 *   two so a request that lands on the wrong host is bounced to the right
 *   one. Localhost / Vercel preview hosts fall through unchanged.
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

const MARKETING_HOST = (process.env.NEXT_PUBLIC_MARKETING_HOST || 'bayaan.ai').toLowerCase();
const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || 'bayaan.app').toLowerCase();

/**
 * Paths that belong on the marketing host. Everything else (auth, dashboard,
 * rooms, donate, manage-rooms, superadmin, ...) belongs on the app host.
 */
const MARKETING_PATHS: ReadonlySet<string> = new Set(['/']);

function stripWww(host: string): string {
  return host.replace(/^www\./, '').split(':')[0];
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() || '';

  // ---- Force apex (no www) on app host --------------------------------
  // Supabase OAuth + email-link flows pin the redirect URL to the host the
  // user started on. If the user lands on www.bayaan.app the redirect goes
  // back to www.bayaan.app/auth/callback, which usually isn't on Supabase's
  // allowlist → silent fallback to the Site URL → user dumped on landing.
  // 308 keeps query string + cookies-by-domain so OAuth code params survive.
  if (host === `www.${APP_HOST}`) {
    const url = request.nextUrl.clone();
    url.host = APP_HOST;
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  // ---- Subdomain → /donate rewrite (org slug subdomains) ---------------
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

  // ---- Two-domain routing: bayaan.ai (marketing) vs bayaan.app (app) ---
  // Skip API and Next internals — they should serve on whichever host the
  // request hits, no redirect bounce. Auth pages ARE host-routed: if the
  // OTP confirm or recovery link ever lands on the marketing host, we want
  // to bounce to the app host so cookies scope correctly.
  const path = request.nextUrl.pathname;
  const isApiOrInternal = path.startsWith('/api') || path.startsWith('/_next');

  if (!isApiOrInternal) {
    const cleanHost = stripWww(host);
    const isMarketingHost = cleanHost === MARKETING_HOST;
    const isAppHost = cleanHost === APP_HOST;
    const isMarketingPath = MARKETING_PATHS.has(path);

    if (isMarketingHost && !isMarketingPath) {
      // Anything that isn't the landing on bayaan.ai → bounce to bayaan.app
      // with the same path + query preserved. 308 keeps method/body if any.
      // Forward the locale picked on the marketing host as a query param
      // so the app host can persist it (cookies don't cross TLDs).
      const url = request.nextUrl.clone();
      url.host = APP_HOST;
      url.protocol = 'https:';
      const localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
      if (localeCookie && !url.searchParams.has('locale')) {
        url.searchParams.set('locale', localeCookie);
      }
      return NextResponse.redirect(url, 308);
    }

    if (isAppHost && isMarketingPath) {
      // Marketing path landed on the app host → bounce to marketing host.
      const url = request.nextUrl.clone();
      url.host = MARKETING_HOST;
      url.protocol = 'https:';
      return NextResponse.redirect(url, 308);
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
