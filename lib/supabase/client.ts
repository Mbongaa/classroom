import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in Client Components
 *
 * This client is designed for browser environments and client-side React components.
 * It uses the browser's localStorage for session management.
 *
 * @example
 * ```tsx
 * 'use client'
 *
 * import { createClient } from '@/lib/supabase/client'
 *
 * export default function MyComponent() {
 *   const supabase = createClient()
 *
 *   async function handleSignIn() {
 *     const { error } = await supabase.auth.signInWithPassword({
 *       email: 'user@example.com',
 *       password: 'password'
 *     })
 *   }
 *
 *   return <button onClick={handleSignIn}>Sign In</button>
 * }
 * ```
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
