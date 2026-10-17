import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { resolveSessionMaxAge, deriveStorageKey, REMEMBER_ME_COOKIE, REMEMBER_ME_COOKIE_VALUE } from '@/lib/supabase/session';

/**
 * Server Supabase client with an optional session cookie maxAge override
 * (seconds). When provided, the session cookie (sb-<ref>-auth-token + chunks)
 * is written with that maxAge; when omitted, the mark of «recordarme» decides
 * (7 days) and without the mark the default is 1 hour (see
 * resolveSessionMaxAge). Removes (value '') and unrelated cookies pass through
 * untouched.
 */
export async function createServerClient(sessionMaxAge?: number) {
  const cookieStore = await cookies();
  const storageKey = deriveStorageKey(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  // El proxy llama a esto sin override en cada request: sin mirar la marca, el
  // refresh del token reescribía la cookie de sesión con 1 hora y el
  // «recordarme» se perdía en el primer refresh.
  const remembered =
    sessionMaxAge === undefined &&
    cookieStore.get(REMEMBER_ME_COOKIE)?.value === REMEMBER_ME_COOKIE_VALUE;

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            const maxAge = resolveSessionMaxAge({ name, value, sessionMaxAge, storageKey, remembered });
            cookieStore.set({ name, value, ...(maxAge !== undefined ? { ...options, maxAge } : options) });
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client (server-only). Synchronous because it does not
 * touch cookies; it uses the service role key for admin operations.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}