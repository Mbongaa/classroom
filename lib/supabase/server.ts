import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client for use in Server Components and API Routes
 *
 * This client is designed for server-side environments including:
 * - Server Components
 * - Server Actions
 * - Route Handlers (API routes)
 *
 * It uses Next.js cookies for session management, ensuring proper SSR behavior.
 *
 * IMPORTANT: This function must be called within an async context and returns a Promise.
 *
 * @example Server Component
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function ServerComponent() {
 *   const supabase = await createClient()
 *
 *   const { data: { user } } = await supabase.auth.getUser()
 *
 *   return <div>Hello {user?.email}</div>
 * }
 * ```
 *
 * @example Server Action
 * ```tsx
 * 'use server'
 *
 * import { createClient } from '@/lib/supabase/server'
 *
 * export async function signIn(formData: FormData) {
 *   const supabase = await createClient()
 *
 *   const { error } = await supabase.auth.signInWithPassword({
 *     email: formData.get('email') as string,
 *     password: formData.get('password') as string,
 *   })
 *
 *   if (error) throw error
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}