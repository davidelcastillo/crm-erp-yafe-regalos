import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key for admin operations.
 * This bypasses RLS and should only be used in secure server environments.
 */
export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};