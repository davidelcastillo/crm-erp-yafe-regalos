/**
 * Unit tests for the auth actions (src/actions/auth.ts).
 *
 * Covers the recordarme (remember-me) contract from the auth-session-persistence
 * spec:
 *   - login() passes REMEMBER_ME_MAX_AGE to createServerClient only when the
 *     remember-me checkbox is 'on'; otherwise the default (undefined → 1h) is used.
 *   - logout() no longer writes the dead sb-token cookie; signOut() clears the
 *     real session cookies via the store.
 */
import { login, logout } from "./auth";

const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockCookieSet = jest.fn();
const mockCookieGet = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    set: (...args: unknown[]) => mockCookieSet(...args),
    get: (...args: unknown[]) => mockCookieGet(...args),
  }),
}));

import { createServerClient } from "@/lib/supabase/server";

const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60; // 604800

function makeFormData(
  overrides: { email?: string; password?: string; remember?: string } = {}
): FormData {
  const fd = new FormData();
  fd.set("email", overrides.email ?? "admin@feriaconexx.com");
  fd.set("password", overrides.password ?? "AdminPass1!");
  if (overrides.remember !== undefined) {
    fd.set("remember-me", overrides.remember);
  }
  return fd;
}

function mockSignInSuccess() {
  mockSignInWithPassword.mockResolvedValue({
    data: { user: { app_metadata: { role: "admin" } } },
    error: null,
  });
  mockCookieGet.mockReturnValue(undefined);
}

describe("login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInSuccess();
    (createServerClient as jest.Mock).mockResolvedValue({
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
    });
  });

  it("passes REMEMBER_ME_MAX_AGE when the remember-me checkbox is 'on'", async () => {
    await login(makeFormData({ remember: "on" }));

    expect(createServerClient).toHaveBeenCalledWith(REMEMBER_ME_MAX_AGE);
  });

  it("passes no override when the remember-me checkbox is absent (default 1h)", async () => {
    await login(makeFormData());

    expect(createServerClient).toHaveBeenCalledWith(undefined);
  });

  it("still validates credentials before calling Supabase", async () => {
    const result = await login(makeFormData({ password: "short" }));

    expect(result).toEqual({
      success: false,
      error: "Invalid email or password",
    });
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    (createServerClient as jest.Mock).mockResolvedValue({
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
    });
  });

  it("signs out and returns the redirect to /login", async () => {
    const result = await logout();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, redirectTo: "/login" });
  });

  it("does not write the dead sb-token cookie", async () => {
    await logout();

    expect(mockCookieSet).not.toHaveBeenCalledWith(
      "sb-token",
      expect.anything(),
      expect.anything()
    );
  });
});