/**
 * Unit tests for sanitizeNextPath (src/lib/auth/sanitize-next.ts).
 *
 * Anti-open-redirect rules from the auth-password-reset design:
 * - only internal relative paths are accepted (starts with "/", no "//", no ":")
 * - anything else falls back to "/reset-password"
 */
import { sanitizeNextPath } from "./sanitize-next";

describe("sanitizeNextPath", () => {
  it.each([
    // [input, expected]
    ["/reset-password", "/reset-password"],
    ["/login", "/login"],
    ["/reset-password?foo=bar", "/reset-password?foo=bar"],
  ])("keeps internal relative path %p unchanged", (input, expected) => {
    expect(sanitizeNextPath(input)).toBe(expected);
  });

  it.each([
    // [input, expected fallback]
    [null, "/reset-password"],
    [undefined, "/reset-password"],
    ["", "/reset-password"],
    ["https://evil.example", "/reset-password"],
    ["//evil.example", "/reset-password"],
    ["javascript:alert(1)", "/reset-password"],
    ["/ruta:puerto", "/reset-password"],
  ])("falls back for unsafe value %p", (input, expected) => {
    expect(sanitizeNextPath(input)).toBe(expected);
  });
});