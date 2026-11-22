import { createClient } from '@supabase/supabase-js';

/** URL base para el STORAGE: permite apuntar el bucket local en desarrollo
 * (el resto del Supabase —auth/login— sigue por NEXT_PUBLIC_SUPABASE_URL) sin
 * cambiar nada en producción, donde la variable no se define. */
export const SUPABASE_STORAGE_URL =
  process.env.SUPABASE_STORAGE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Creates a Supabase client with the service role key for admin operations.
 * This bypasses RLS and should only be used in secure server environments.
 */
export const createAdminClient = () => {
  return createClient(
    SUPABASE_STORAGE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};