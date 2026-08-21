// src/lib/utils/supabaseAuth.ts
import { getRandomValues } from "crypto";

const DEFAULT_EMAIL_DOMAIN = "feriaconexx.com";

/**
 * Matches a canonical UUID v4 string (version nibble = 4, variant = 8/9/a/b).
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true only when `value` is a well-formed UUID v4 string. Guards
 * against non-UUID placeholders (e.g. all-zero ids) before passing a userId
 * to Supabase Auth admin calls.
 */
export function isValidUuid(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return UUID_V4_REGEX.test(value);
}

const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const DIGIT_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()-_=+[]{};:,.<>?";
const ALL_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + DIGIT_CHARS + SYMBOL_CHARS;

const DEFAULT_PASSWORD_LENGTH = 14;

// ---------------------------------------------------------------------------
// Random helpers (server-only, Node crypto)
// ---------------------------------------------------------------------------

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1);
  getRandomValues(buffer);
  return buffer[0] % max;
}

function randomChar(chars: string): string {
  return chars[randomIndex(chars.length)];
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/**
 * Generates a temporary password of at least 12 characters covering the four
 * character classes (uppercase, lowercase, digit, symbol). Uses Node crypto
 * for cryptographically strong randomness.
 */
export function generateTemporaryPassword(length = DEFAULT_PASSWORD_LENGTH): string {
  const required = [
    randomChar(UPPERCASE_CHARS),
    randomChar(LOWERCASE_CHARS),
    randomChar(DIGIT_CHARS),
    randomChar(SYMBOL_CHARS),
  ];

  const chars = [...required];
  while (chars.length < length) {
    chars.push(randomChar(ALL_CHARS));
  }

  // Fisher-Yates shuffle so the required characters are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Derives the branch user email from the branch code, e.g. "CEN" ->
 * "sucursal-cen@feriaconexx.com". The domain can be overridden via the
 * BRANCH_EMAIL_DOMAIN environment variable or an explicit `domain` argument.
 */
export function generateBranchEmail(branchCode: string, domain?: string): string {
  const resolvedDomain = domain ?? process.env.BRANCH_EMAIL_DOMAIN ?? DEFAULT_EMAIL_DOMAIN;
  return `sucursal-${branchCode.toLowerCase()}@${resolvedDomain}`;
}

// ---------------------------------------------------------------------------
// Branch user provisioning (Supabase Auth admin wrappers)
// ---------------------------------------------------------------------------

export interface BranchUserInput {
  email: string;
  password: string;
  name: string;
  branchId: number;
}

export type CreateBranchUserResult =
  | { id: string; error: null }
  | { id: null; error: string };

export type DeleteBranchUserResult = { error: string | null };

/**
 * Minimal structural type for the Supabase service client pieces used here,
 * so these helpers stay testable with a mocked client.
 */
export interface SupabaseAuthAdminClient {
  auth: {
    admin: {
      createUser(payload: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: { name: string; branchId: number };
        app_metadata: { role: "branch_user"; branchId: number };
      }): Promise<{
        data: { user?: { id: string } | null } | null;
        error: { message: string } | null;
      }>;
      deleteUser(userId: string): Promise<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Creates an Auth user for a branch with role claim and confirmed email.
 * Returns a normalized result so callers never handle Supabase's raw shape.
 */
export async function createBranchUser(
  client: SupabaseAuthAdminClient,
  { email, password, name, branchId }: BranchUserInput
): Promise<CreateBranchUserResult> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, branchId },
    app_metadata: { role: "branch_user", branchId },
  });

  if (error || !data?.user?.id) {
    return { id: null, error: error?.message ?? "No se pudo crear el usuario" };
  }

  return { id: data.user.id, error: null };
}

/**
 * Deletes an Auth user. Non-UUID placeholders (e.g. legacy zero-filled ids)
 * are skipped with a warning — the Auth user cannot exist for them, and
 * Supabase Auth's admin API throws on malformed UUIDs. Other failures are
 * propagated to the caller.
 */
export async function deleteBranchUser(
  client: SupabaseAuthAdminClient,
  userId: string
): Promise<DeleteBranchUserResult> {
  if (!isValidUuid(userId)) {
    console.warn(
      `deleteBranchUser: skipping deletion for invalid/placeholder userId "${userId}" (not a UUID v4)`
    );
    return { error: null };
  }

  const { error } = await client.auth.admin.deleteUser(userId);
  return { error: error?.message ?? null };
}
