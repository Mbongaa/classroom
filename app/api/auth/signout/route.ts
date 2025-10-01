import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Sign Out Route Handler
 *
 * This API endpoint handles user sign out.
 * It can be called from either client or server components.
 *
 * Usage:
 * - POST request to /api/auth/signout
 * - Optionally include a 'redirect' parameter in the body
 *
 * @example Client Component
 * ```tsx
 * async function handleSignOut() {
 *   await fetch('/api/auth/signout', { method: 'POST' })
 *   window.location.href = '/'
 * }
 * ```
 *
 * @param request - The incoming sign out request
 * @returns JSON response with success/error status
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if a user is signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  // Revalidate the entire site to clear cached user data
  revalidatePath('/', 'layout');

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();

  // Check if a user is signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  // Revalidate the entire site to clear cached user data
  revalidatePath('/', 'layout');

  // Redirect to login page
  return NextResponse.redirect(new URL('/login', request.url));
}
