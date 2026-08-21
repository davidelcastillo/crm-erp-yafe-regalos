/**
 * Unit tests for branch user provisioning helpers (src/lib/utils/supabaseAuth)
 *
 * Covers:
 *   - generateTemporaryPassword: length + character-class coverage
 *   - generateBranchEmail: format with default and overridden domain
 *   - createBranchUser: success + error passthrough (mocked client)
 *   - deleteBranchUser: success + error passthrough (mocked client)
 *
 * Acceptance criteria sourced from:
 *   - openspec/specs/branch-user-provisioning/spec.md (Create/Delete requirements)
 */

import {
  generateTemporaryPassword,
  generateBranchEmail,
  createBranchUser,
  deleteBranchUser,
  isValidUuid,
  type SupabaseAuthAdminClient,
} from "./supabaseAuth";

const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /[0-9]/;
const SYMBOL_RE = /[^A-Za-z0-9]/;

// ---------------------------------------------------------------------------
// generateTemporaryPassword
// ---------------------------------------------------------------------------
describe("generateTemporaryPassword", () => {
  it("returns a password of at least 12 characters", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword();
      expect(password.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("includes at least one char from each of the 4 classes", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(UPPERCASE_RE);
      expect(password).toMatch(LOWERCASE_RE);
      expect(password).toMatch(DIGIT_RE);
      expect(password).toMatch(SYMBOL_RE);
    }
  });

  it("generates different values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(generateTemporaryPassword());
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// generateBranchEmail
// ---------------------------------------------------------------------------
describe("generateBranchEmail", () => {
  it("builds sucursal-<code>@feriaconexx.com with a lowercased code", () => {
    expect(generateBranchEmail("CEN")).toBe("sucursal-cen@feriaconexx.com");
    expect(generateBranchEmail("centro")).toBe("sucursal-centro@feriaconexx.com");
  });

  it("respects an explicit domain override", () => {
    expect(generateBranchEmail("CEN", "example.com")).toBe("sucursal-cen@example.com");
  });

  it("falls back to the BRANCH_EMAIL_DOMAIN env var when set", () => {
    const original = process.env.BRANCH_EMAIL_DOMAIN;
    process.env.BRANCH_EMAIL_DOMAIN = "miempresa.com";
    try {
      expect(generateBranchEmail("SN")).toBe("sucursal-sn@miempresa.com");
    } finally {
      if (original === undefined) {
        delete process.env.BRANCH_EMAIL_DOMAIN;
      } else {
        process.env.BRANCH_EMAIL_DOMAIN = original;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// createBranchUser
// ---------------------------------------------------------------------------
describe("createBranchUser", () => {
  const input = {
    email: "sucursal-cen@feriaconexx.com",
    password: "TemporaryPass1!",
    name: "Sucursal Centro",
    branchId: 7,
  };

  function buildClient(
    overrides: Partial<SupabaseAuthAdminClient["auth"]["admin"]> = {}
  ): { client: SupabaseAuthAdminClient; createUser: jest.Mock } {
    const createUser = jest.fn();
    const client = {
      auth: {
        admin: {
          createUser,
          ...overrides,
        },
      },
    } as unknown as SupabaseAuthAdminClient;
    return { client, createUser };
  }

  it("returns the created user id and null error on success", async () => {
    const { client, createUser } = buildClient();
    createUser.mockResolvedValue({
      data: { user: { id: "auth-user-123" } },
      error: null,
    });

    const result = await createBranchUser(client, input);

    expect(result).toEqual({ id: "auth-user-123", error: null });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "sucursal-cen@feriaconexx.com",
        password: "TemporaryPass1!",
        email_confirm: true,
        user_metadata: { name: "Sucursal Centro", branchId: 7 },
        app_metadata: { role: "branch_user", branchId: 7 },
      })
    );
  });

  it("propagates the auth error as a normalized string", async () => {
    const { client, createUser } = buildClient();
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const result = await createBranchUser(client, input);

    expect(result).toEqual({ id: null, error: "User already registered" });
  });

  it("returns an error when the response has no user id", async () => {
    const { client, createUser } = buildClient();
    createUser.mockResolvedValue({ data: null, error: null });

    const result = await createBranchUser(client, input);

    expect(result.error).not.toBeNull();
    expect(result.id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidUuid
// ---------------------------------------------------------------------------
describe("isValidUuid", () => {
  it("accepts a valid UUID v4", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects a non-v4 all-zero placeholder UUID", () => {
    expect(isValidUuid("00000000-0000-0000-0000-000000000001")).toBe(false);
  });

  it("accepts a v4-format all-zero variant", () => {
    expect(isValidUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("rejects null, undefined, and malformed strings", () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-44665544000Z")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteBranchUser
// ---------------------------------------------------------------------------
describe("deleteBranchUser", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  function buildClient(
    deleteUserImpl: () => Promise<{ error: { message: string } | null }>
  ): { client: SupabaseAuthAdminClient; deleteUser: jest.Mock } {
    const deleteUser = jest.fn(deleteUserImpl);
    const client = {
      auth: {
        admin: {
          createUser: jest.fn(),
          deleteUser,
        },
      },
    } as unknown as SupabaseAuthAdminClient;
    return { client, deleteUser };
  }

  it("returns a null error when deletion succeeds", async () => {
    const { client, deleteUser } = buildClient(async () => ({ error: null }));

    const result = await deleteBranchUser(client, VALID_UUID);

    expect(result).toEqual({ error: null });
    expect(deleteUser).toHaveBeenCalledWith(VALID_UUID);
  });

  it("propagates the error message when deletion fails (user-not-found passthrough)", async () => {
    const { client, deleteUser } = buildClient(async () => ({
      error: { message: "User not found" },
    }));

    const result = await deleteBranchUser(client, VALID_UUID);

    expect(result).toEqual({ error: "User not found" });
    expect(deleteUser).toHaveBeenCalledWith(VALID_UUID);
  });

  it("skips deletion for an invalid/placeholder UUID, warns, and returns null error", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { client, deleteUser } = buildClient(async () => ({ error: null }));

    const result = await deleteBranchUser(
      client,
      "00000000-0000-0000-0000-000000000001"
    );

    expect(deleteUser).not.toHaveBeenCalled();
    expect(result).toEqual({ error: null });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("00000000-0000-0000-0000-000000000001")
    );
    warnSpy.mockRestore();
  });
});
