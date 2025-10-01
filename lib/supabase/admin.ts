import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase admin client with service role key
 *
 * WARNING: This client bypasses Row Level Security (RLS) policies.
 * Only use this for administrative operations where you need to bypass RLS,
 * such as initial setup during user signup.
 *
 * NEVER expose this client or the service role key to the client side.
 * This should only be used in server-side code.
 *
 * @example
 * ```ts
 * import { createAdminClient } from '@/lib/supabase/admin'
 *
 * const supabaseAdmin = createAdminClient()
 *
 * // This bypasses RLS - use with caution!
 * const { data, error } = await supabaseAdmin
 *   .from('organizations')
 *   .insert({ name: 'Test Org' })
 * ```
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
