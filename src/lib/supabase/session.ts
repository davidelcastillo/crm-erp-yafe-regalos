/**
 * Pure helpers for controlling the session cookie maxAge from the app store.
 *
 * @supabase/ssr 0.12.4 always overrides cookieOptions.maxAge with 400 days
 * (DEFAULT_COOKIE_OPTIONS.maxAge), so the real session-duration control is the
 * maxAge applied to the sb-<ref>-auth-token cookie (+ chunks) in the store.
 */
export const DEFAULT_SESSION_MAX_AGE = 60 * 60; // 1 hora
export const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60; // 7 días (604800 s)

/**
 * Marca de «recordarme»: cookie propia, con la misma duración que la sesión que
 * pide. Es una preferencia, no una credencial; existe porque la elección vivía
 * solo en el maxAge de la escritura del login y el refresh del token (el proxy
 * llama createServerClient() sin override) reescribía la cookie de sesión con
 * el default de 1 hora: el «recordarme» se perdía en el primer refresh.
 */
export const REMEMBER_ME_COOKIE = "remember-me";
export const REMEMBER_ME_COOKIE_VALUE = "1";

export function deriveStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

export function resolveSessionMaxAge(input: {
  name: string;
  value: string;
  sessionMaxAge?: number;
  storageKey: string;
  /** La marca de «recordarme» (REMEMBER_ME_COOKIE) está presente. */
  remembered?: boolean;
}): number | undefined {
  if (!input.value) return undefined; // remove → passthrough
  if (!input.name.startsWith(input.storageKey)) return undefined; // otras cookies
  if (input.sessionMaxAge !== undefined) return input.sessionMaxAge;
  return input.remembered ? REMEMBER_ME_MAX_AGE : DEFAULT_SESSION_MAX_AGE;
}