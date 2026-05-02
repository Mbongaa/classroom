import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Update session for middleware
 *
 * This function is called by the middleware to manage user sessions across requests.
 * It handles:
 * - Session cookie management
 * - Session refresh
 * - User authentication state
 *
 * IMPORTANT: Do NOT add any logic between createServerClient and supabase.auth.getUser().
 * A simple mistake could make it very hard to debug issues with users being randomly logged out.
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse with updated session cookies
 */
export async function updateSession(request: NextRequest) {
  // Mutable headers we forward to downstream handlers. Always strip any
  // client-supplied x-supabase-user-id to prevent header spoofing — this
  // header is treated as authoritative by route handlers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-supabase-user-id');
  // Expose the pathname to server components so the root layout can decide
  // whether to render with the marketing/auth surface class on <html>
  // before first paint (kills the dark flash on Android).
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Propagate the validated user id to downstream API routes so they can skip
  // a duplicate auth.getUser() round-trip. Trusted because middleware always
  // runs before route handlers and we strip any inbound value above.
  if (user) {
    requestHeaders.set('x-supabase-user-id', user.id);
    // Rebuild the response so the new header is visible downstream, while
    // preserving any cookies Supabase set during session refresh above.
    const refreshedCookies = supabaseResponse.cookies.getAll();
    supabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    refreshedCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));
  }

  // Protected routes - require authentication
  const protectedPaths = ['/dashboard', '/manage-rooms', '/profile', '/org', '/superadmin', '/billing', '/welcome'];
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // Public routes - accessible without authentication
  const publicPaths = ['/rooms', '/r', '/custom', '/login', '/signup', '/auth', '/learn', '/api/webhooks'];
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  // Redirect authenticated users from landing page to dashboard
  if (user && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users to login for protected routes
  if (
    !user &&
    isProtectedPath &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/signup'))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
