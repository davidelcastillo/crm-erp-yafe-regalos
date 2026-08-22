/**
 * Pure helpers for controlling the session cookie maxAge from the app store.
 *
 * @supabase/ssr 0.12.4 always overrides cookieOptions.maxAge with 400 days
 * (DEFAULT_COOKIE_OPTIONS.maxAge), so the real session-duration control is the
 * maxAge applied to the sb-<ref>-auth-token cookie (+ chunks) in the store.
 */
export const DEFAULT_SESSION_MAX_AGE = 60 * 60; // 1 hora
export const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60; // 7 días (604800 s)

export function deriveStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

export function resolveSessionMaxAge(input: {
  name: string;
  value: string;
  sessionMaxAge?: number;
  storageKey: string;
}): number | undefined {
  if (!input.value) return undefined; // remove → passthrough
  if (!input.name.startsWith(input.storageKey)) return undefined; // otras cookies
  return input.sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE;
}