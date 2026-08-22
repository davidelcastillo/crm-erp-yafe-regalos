/**
 * Anti-open-redirect sanitizer for the `next` query parameter used by the
 * password-reset flow (/auth/callback?next=...). Only internal relative paths
 * are accepted; anything else falls back to /reset-password.
 */
const FALLBACK = '/reset-password';

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  if (!value.startsWith('/')) return FALLBACK;
  if (value.startsWith('//')) return FALLBACK;
  if (value.includes(':')) return FALLBACK;
  return value;
}