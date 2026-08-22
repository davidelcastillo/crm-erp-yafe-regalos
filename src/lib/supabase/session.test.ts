/**
 * Unit tests for the pure session module (src/lib/supabase/session.ts).
 *
 * Covers the cookie maxAge override contract from the auth-session-persistence
 * spec: deriveStorageKey builds the sb-<ref>-auth-token prefix from the
 * Supabase URL, and resolveSessionMaxAge applies the override only to session
 * cookies (main + chunks), never to removes or unrelated cookies.
 */
import {
  DEFAULT_SESSION_MAX_AGE,
  REMEMBER_ME_MAX_AGE,
  deriveStorageKey,
  resolveSessionMaxAge,
} from "./session";

const STORAGE_KEY = "sb-abcdefgh-auth-token";

describe("deriveStorageKey", () => {
  it("derives sb-<ref>-auth-token from the Supabase URL hostname", () => {
    expect(deriveStorageKey("https://abcdefgh.supabase.co")).toBe(STORAGE_KEY);
  });

  it("derives the key from the first hostname label (design contract: split('.')[0])", () => {
    // Design: `sb-${hostname.split('.')[0]}-auth-token` — for a custom domain
    // the first label is the ref-like segment, not the full domain.
    expect(deriveStorageKey("https://auth.example.com")).toBe(
      "sb-auth-auth-token"
    );
  });
});

describe("resolveSessionMaxAge", () => {
  it("returns undefined for a remove (empty value) even for the session cookie", () => {
    expect(
      resolveSessionMaxAge({
        name: STORAGE_KEY,
        value: "",
        storageKey: STORAGE_KEY,
      })
    ).toBeUndefined();
  });

  it("returns undefined for a cookie that is not a session cookie", () => {
    expect(
      resolveSessionMaxAge({
        name: "redirect-to",
        value: "/dashboard",
        storageKey: STORAGE_KEY,
      })
    ).toBeUndefined();
  });

  it("returns the default max age for the session cookie without an override", () => {
    expect(
      resolveSessionMaxAge({
        name: STORAGE_KEY,
        value: "token-value",
        storageKey: STORAGE_KEY,
      })
    ).toBe(DEFAULT_SESSION_MAX_AGE);
    expect(DEFAULT_SESSION_MAX_AGE).toBe(3600);
  });

  it("returns the default max age for session cookie chunks (.0 / .1)", () => {
    expect(
      resolveSessionMaxAge({
        name: `${STORAGE_KEY}.0`,
        value: "chunk-0",
        storageKey: STORAGE_KEY,
      })
    ).toBe(3600);
    expect(
      resolveSessionMaxAge({
        name: `${STORAGE_KEY}.1`,
        value: "chunk-1",
        storageKey: STORAGE_KEY,
      })
    ).toBe(3600);
  });

  it("uses the remember-me override when provided", () => {
    expect(
      resolveSessionMaxAge({
        name: STORAGE_KEY,
        value: "token-value",
        sessionMaxAge: REMEMBER_ME_MAX_AGE,
        storageKey: STORAGE_KEY,
      })
    ).toBe(REMEMBER_ME_MAX_AGE);
    expect(REMEMBER_ME_MAX_AGE).toBe(604800);
  });
});