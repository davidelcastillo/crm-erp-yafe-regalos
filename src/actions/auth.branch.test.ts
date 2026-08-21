/**
 * Unit tests for the branch portal login action (src/actions/auth.branch.ts)
 *
 * Covers the claim-match / claim-mismatch / invalid-credentials paths from the
 * FASE 4 spec (openspec/changes/fix-fase4-correcciones/specs/branch-portal-access/spec.md):
 *   - matching role + branchId claim  -> redirect to /sucursal/<id>/inventory
 *   - branchId claim differs from URL -> error, session discarded, no redirect
 *   - role is not branch_user         -> error, session discarded, no redirect
 *   - invalid credentials             -> error, no redirect, signOut NOT called
 */
import { loginBranch } from "./auth.branch";

const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

const BRANCH_210_USER = {
  app_metadata: { role: "branch_user", branchId: 210 },
};

function makeFormData(
  overrides: Partial<Record<"email" | "password", string>> = {}
): FormData {
  const fd = new FormData();
  fd.set("email", overrides.email ?? "sucursal-210@feriaconexx.com");
  fd.set("password", overrides.password ?? "BranchPass1!");
  return fd;
}

describe("loginBranch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({
      data: { user: BRANCH_210_USER },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("redirects to the branch inventory when role and branchId claim match the URL", async () => {
    const result = await loginBranch(makeFormData(), 210);

    expect(result).toEqual({
      success: true,
      redirectTo: "/sucursal/210/inventory",
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "sucursal-210@feriaconexx.com",
      password: "BranchPass1!",
    });
    // A matching session is kept — signOut must NOT be called.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("rejects when the branchId claim does not match the URL branchId", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {
        user: { app_metadata: { role: "branch_user", branchId: 200 } },
      },
      error: null,
    });

    const mismatch = await loginBranch(makeFormData(), 210);

    expect(mismatch).toEqual({
      success: false,
      error: "Credenciales no válidas para esta sucursal",
    });
    expect(mismatch.redirectTo).toBeUndefined();
    // The mismatched session must be discarded.
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("rejects when the role is not branch_user", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {
        user: { app_metadata: { role: "admin", branchId: 210 } },
      },
      error: null,
    });

    const result = await loginBranch(makeFormData(), 210);

    expect(result).toEqual({
      success: false,
      error: "Credenciales no válidas para esta sucursal",
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid credentials without discarding a session", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await loginBranch(makeFormData(), 210);

    expect(result).toEqual({
      success: false,
      error: "Credenciales no válidas para esta sucursal",
    });
    expect(result.redirectTo).toBeUndefined();
    // No session was created, so there is nothing to sign out.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("rejects invalid form input before calling Supabase", async () => {
    const result = await loginBranch(makeFormData({ password: "short" }), 210);

    expect(result).toEqual({
      success: false,
      error: "Credenciales no válidas para esta sucursal",
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
