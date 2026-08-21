/**
 * Unit/Integration tests for Branch Management (HU2)
 *
 * Covers:
 *   - Zod validation schemas (createBranchSchema, updateBranchSchema, deleteBranchSchema)
 *   - Branch CRUD Server Actions (create, get, update, delete, getBranchOptions)
 *
 * Acceptance criteria sourced from:
 *   - openspec/specs/branch-management/spec.md (Create/Read/Update/Delete requirements)
 */

import {
  createBranchSchema,
  updateBranchSchema,
  deleteBranchSchema,
} from "@/lib/validations/branch";
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  getBranchOptions,
} from "@/app/actions/branch";

// ---------------------------------------------------------------------------
// Prisma mock factory (matches the pattern used across this codebase)
// ---------------------------------------------------------------------------
const mockBranchCreate = jest.fn();
const mockBranchFindFirst = jest.fn();
const mockBranchFindMany = jest.fn();
const mockBranchFindUnique = jest.fn();
const mockBranchUpdate = jest.fn();
const mockBranchDelete = jest.fn();
const mockPurchaseCount = jest.fn();
const mockSaleCount = jest.fn();
const mockBranchInventoryCount = jest.fn();

jest.mock("@/lib/prisma", () => {
  const tx = {
    branch: {
      create: (...args: unknown[]) => mockBranchCreate(...args),
      findFirst: (...args: unknown[]) => mockBranchFindFirst(...args),
      findMany: (...args: unknown[]) => mockBranchFindMany(...args),
      findUnique: (...args: unknown[]) => mockBranchFindUnique(...args),
      update: (...args: unknown[]) => mockBranchUpdate(...args),
      delete: (...args: unknown[]) => mockBranchDelete(...args),
    },
    branchInventory: {
      count: (...args: unknown[]) => mockBranchInventoryCount(...args),
    },
    purchase: {
      count: (...args: unknown[]) => mockPurchaseCount(...args),
    },
    sale: {
      count: (...args: unknown[]) => mockSaleCount(...args),
    },
  };

  return {
    prisma: {
      ...tx,
      $transaction: async (
        callback: (t: typeof tx) => Promise<unknown>
      ): Promise<unknown> => callback(tx),
    },
  };
});

// revalidatePath is called in the actions; mock it to avoid Next internals
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// Mock Supabase role/claims helpers so the server actions don't hit the real API
jest.mock("@/lib/supabase/auth", () => ({
  hasUserRole: jest.fn().mockResolvedValue(true),
}));

// Mock the Supabase clients (admin + cookie-based) to avoid real side effects
const mockCreateUser = jest.fn().mockResolvedValue({
  data: { user: { id: "auth-user-123" } },
  error: null,
});
const mockDeleteUser = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn().mockReturnValue({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  }),
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "session-user-1" } },
        error: null,
      }),
    },
  }),
}));

// Import the mocked helpers to wire assertions if needed
import { hasUserRole } from "@/lib/supabase/auth";
import { createServiceClient, createServerClient } from "@/lib/supabase/server";

const baseValidInput = {
  name: "Sucursal Centro",
  address: "Av. Corrientes 1234",
  phone: "+54 11 5555-5555",
  email: "centro@tienda.com",
  isActive: true,
  code: "CENTRO",
};

const mockBranchRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: "Sucursal Centro",
  address: "Av. Corrientes 1234",
  phone: "+54 11 5555-5555",
  email: "centro@tienda.com",
  code: "CENTRO",
  isActive: true,
  createdAt: new Date("2026-07-30T12:00:00.000Z"),
  updatedAt: new Date("2026-07-30T12:00:00.000Z"),
  ...overrides,
});

// ===========================================================================
// Unit: Zod validation schemas
// ===========================================================================
describe("branch validation schemas (HU2)", () => {
  describe("createBranchSchema", () => {
    it("accepts a fully-populated valid input", () => {
      const parsed = createBranchSchema.parse(baseValidInput);
      expect(parsed.name).toBe("Sucursal Centro");
      expect(parsed.isActive).toBe(true);
    });

    it("accepts minimal input (only name + code) and defaults isActive to true", () => {
      const parsed = createBranchSchema.parse({ name: "Sucursal Norte", code: "sn" });
      expect(parsed.name).toBe("Sucursal Norte");
      // code is uppercased by the transform
      expect(parsed.code).toBe("SN");
      expect(parsed.address).toBeUndefined();
      expect(parsed.phone).toBeUndefined();
      expect(parsed.email).toBeUndefined();
      expect(parsed.isActive).toBe(true);
    });

    it("rejects missing code", () => {
      const result = createBranchSchema.safeParse({ name: "Sucursal" });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name", () => {
      const result = createBranchSchema.safeParse({ name: "", code: "SN" });
      expect(result.success).toBe(false);
    });

    it("rejects a name longer than 255 chars", () => {
      const result = createBranchSchema.safeParse({ name: "x".repeat(256), code: "SN" });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid email", () => {
      const result = createBranchSchema.safeParse({
        name: "Sucursal",
        email: "not-an-email",
        code: "SN",
      });
      expect(result.success).toBe(false);
    });

    it("accepts an empty-string email (or-literal) as nullable fallback", () => {
      const parsed = createBranchSchema.parse({ name: "Sucursal", email: "", code: "SN" });
      expect(parsed.email).toBe("");
    });
  });

  describe("updateBranchSchema", () => {
    it("requires a positive integer id", () => {
      expect(updateBranchSchema.safeParse({ id: 0 }).success).toBe(false);
      expect(
        updateBranchSchema.safeParse({ id: -1 }).success
      ).toBe(false);
      expect(
        updateBranchSchema.safeParse({ id: 1, name: "X" }).success
      ).toBe(true);
    });

    it("accepts partial updates (only isActive)", () => {
      const parsed = updateBranchSchema.parse({ id: 3, isActive: false });
      expect(parsed.id).toBe(3);
      expect(parsed.isActive).toBe(false);
      expect(parsed.name).toBeUndefined();
    });
  });

  describe("deleteBranchSchema", () => {
    it("accepts a positive integer id", () => {
      expect(deleteBranchSchema.safeParse({ id: 5 }).success).toBe(true);
    });

    it("rejects a non-positive id", () => {
      expect(deleteBranchSchema.safeParse({ id: 0 }).success).toBe(false);
      expect(
        deleteBranchSchema.safeParse({ id: -2 }).success
      ).toBe(false);
    });
  });
});

// ===========================================================================
// Integration: Branch CRUD Server Actions (mocked Prisma)
// ===========================================================================
describe("createBranch Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchFindFirst.mockResolvedValue(null); // no duplicate code by default
  });

  it("creates an active branch and returns branch data plus one-time credentials", async () => {
    mockBranchCreate.mockResolvedValue(mockBranchRecord());
    mockBranchUpdate.mockResolvedValue(
      mockBranchRecord({ authUserId: "auth-user-123" })
    );

    const result = await createBranch(baseValidInput);

    expect(result.success).toBe(true);
    expect(result.data?.branch?.id).toBe(1);
    expect(result.data?.branch?.name).toBe("Sucursal Centro");
    expect(result.data?.branch?.isActive).toBe(true);
    // Dates parsed to ISO strings by parseObject
    expect(typeof result.data?.branch?.createdAt).toBe("string");
    // One-time credentials are returned (email derived from the branch code)
    expect(result.data?.credentials?.email).toBe(
      "sucursal-centro@feriaconexx.com"
    );
    expect(result.data?.credentials?.password.length).toBeGreaterThanOrEqual(
      12
    );
    // The Auth user is provisioned with the branch claims and confirmed email
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "sucursal-centro@feriaconexx.com",
        email_confirm: true,
        user_metadata: { name: "Sucursal Centro", branchId: 1 },
        app_metadata: { role: "branch_user", branchId: 1 },
      })
    );
    expect(mockBranchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Sucursal Centro",
        isActive: true,
      }),
    });
  });

  it("rolls back the branch insert when the Auth user creation fails", async () => {
    mockBranchCreate.mockResolvedValue(mockBranchRecord());
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const result = await createBranch(baseValidInput);

    // The auth error is not leaked to the client — generic message only.
    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al crear la sucursal");
    // The branch row WAS inserted inside the transaction...
    expect(mockBranchCreate).toHaveBeenCalledTimes(1);
    // ...but the thrown error rolls it back: no authUserId update is applied
    // and no credentials are returned. With real Prisma the rollback is
    // automatic, so no compensating tx.branch.delete is issued.
    expect(mockBranchUpdate).not.toHaveBeenCalled();
    expect(mockBranchDelete).not.toHaveBeenCalled();
  });

  it("returns a Zod error when name is empty", async () => {
    const result = await createBranch({ ...baseValidInput, name: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("nombre");
  });

  it("returns a Zod error when code is invalid (too short or special chars)", async () => {
    const result = await createBranch({ ...baseValidInput, code: "a!" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("código");
  });

  it("rejects a duplicate code with DUPLICATE_CODE", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 2, code: "CENTRO" });
    const result = await createBranch(baseValidInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe("DUPLICATE_CODE");
    expect(mockBranchCreate).not.toHaveBeenCalled();
  });

  it("returns a generic error on unexpected database failure", async () => {
    mockBranchCreate.mockRejectedValue(new Error("DB down"));
    const result = await createBranch(baseValidInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al crear la sucursal");
  });
});

describe("getBranches Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all branches ordered by createdAt ascending", async () => {
    const records = [
      mockBranchRecord({ id: 1, name: "Principal" }),
      mockBranchRecord({ id: 2, name: "Centro", isActive: false }),
    ];
    mockBranchFindMany.mockResolvedValue(records);

    const result = await getBranches();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.name).toBe("Principal");
  });

  it("returns an empty array when no branches exist", async () => {
    mockBranchFindMany.mockResolvedValue([]);
    const result = await getBranches();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it("returns an error on database failure", async () => {
    mockBranchFindMany.mockRejectedValue(new Error("DB down"));
    const result = await getBranches();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al obtener las sucursales");
  });
});

describe("getBranchById Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single branch by id with all fields", async () => {
    mockBranchFindUnique.mockResolvedValue(mockBranchRecord({ id: 5 }));
    const result = await getBranchById(5);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(5);
    expect(mockBranchFindUnique).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("returns a not-found error when the branch does not exist", async () => {
    mockBranchFindUnique.mockResolvedValue(null);
    const result = await getBranchById(999);
    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrada");
  });
});

describe("updateBranch Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates name and phone and updates timestamps", async () => {
    const updated = mockBranchRecord({
      id: 3,
      name: "Sucursal Sur",
      phone: "+54 11 4444-4444",
      updatedAt: new Date("2026-07-30T13:00:00.000Z"),
    });
    mockBranchUpdate.mockResolvedValue(updated);

    const result = await updateBranch({
      id: 3,
      name: "Sucursal Sur",
      phone: "+54 11 4444-4444",
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Sucursal Sur");
    expect(result.data?.phone).toBe("+54 11 4444-4444");
    expect(mockBranchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ name: "Sucursal Sur" }),
      })
    );
  });

  it("can deactivate a branch (isActive=false) without deleting it (preserves history)", async () => {
    const deactivated = mockBranchRecord({ id: 4, isActive: false });
    mockBranchUpdate.mockResolvedValue(deactivated);

    const result = await updateBranch({ id: 4, isActive: false });

    expect(result.success).toBe(true);
    expect(result.data?.isActive).toBe(false);
    // The action must call .update, never .delete
    expect(mockBranchDelete).not.toHaveBeenCalled();
  });

  it("rejects an invalid id (Zod)", async () => {
    const result = await updateBranch({ id: 0, name: "X" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });
});

describe("deleteBranch Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks deletion of the default branch (id=1)", async () => {
    const result = await deleteBranch({ id: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toBe("DEFAULT_BRANCH");
    expect(mockBranchDelete).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("blocks deletion when the branch has associated purchases (HAS_DEPENDENT_DATA)", async () => {
    mockPurchaseCount.mockResolvedValue(3);
    mockSaleCount.mockResolvedValue(0);

    const result = await deleteBranch({ id: 2 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("HAS_DEPENDENT_DATA");
    expect(mockBranchDelete).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("blocks deletion when the branch has associated sales (HAS_DEPENDENT_DATA)", async () => {
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(5);

    const result = await deleteBranch({ id: 2 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("HAS_DEPENDENT_DATA");
    expect(mockBranchDelete).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("blocks deletion when the branch has stock > 0 (HAS_STOCK)", async () => {
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(0);
    mockBranchInventoryCount.mockResolvedValue(2); // stock > 0 count

    const result = await deleteBranch({ id: 2 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("HAS_STOCK");
    expect(mockBranchDelete).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes the Auth user first, then permanently deletes the empty branch", async () => {
    mockBranchFindUnique.mockResolvedValue({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
    });
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(0);
    mockBranchInventoryCount.mockResolvedValue(0);
    mockBranchDelete.mockResolvedValue(undefined);

    const result = await deleteBranch({ id: 7 });

    expect(result.success).toBe(true);
    // Auth user removed BEFORE the branch row
    expect(mockDeleteUser).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
    expect(mockBranchDelete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("deletes the branch even when authUserId is an invalid/placeholder UUID (Auth deletion skipped)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockBranchFindUnique.mockResolvedValue({
      authUserId: "00000000-0000-0000-0000-000000000001",
    });
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(0);
    mockBranchInventoryCount.mockResolvedValue(0);
    mockBranchDelete.mockResolvedValue(undefined);

    const result = await deleteBranch({ id: 7 });

    expect(result.success).toBe(true);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockBranchDelete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not a valid UUID")
    );
    warnSpy.mockRestore();
  });

  it("continues with branch deletion when the Auth user does not exist (non-fatal)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockBranchFindUnique.mockResolvedValue({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
    });
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(0);
    mockBranchInventoryCount.mockResolvedValue(0);
    mockBranchDelete.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValueOnce({
      error: { message: "User not found" },
    });

    const result = await deleteBranch({ id: 7 });

    expect(result.success).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
    expect(mockBranchDelete).toHaveBeenCalledWith({ where: { id: 7 } });
    warnSpy.mockRestore();
  });

  it("aborts branch deletion on a real auth error (e.g. network)", async () => {
    mockBranchFindUnique.mockResolvedValue({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
    });
    mockPurchaseCount.mockResolvedValue(0);
    mockSaleCount.mockResolvedValue(0);
    mockBranchInventoryCount.mockResolvedValue(0);
    mockDeleteUser.mockResolvedValueOnce({
      error: { message: "Network error" },
    });

    const result = await deleteBranch({ id: 7 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al eliminar la sucursal");
    expect(mockBranchDelete).not.toHaveBeenCalled();
  });

  it("rejects an invalid id (Zod)", async () => {
    const result = await deleteBranch({ id: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });
});

describe("getBranchOptions Server Action (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only id and name for active branches, ordered by name asc", async () => {
    mockBranchFindMany.mockResolvedValue([
      { id: 2, name: "Centro" },
      { id: 1, name: "Principal" },
    ]);

    const result = await getBranchOptions();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]).toEqual({ id: 2, name: "Centro" });
    expect(mockBranchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    );
  });

  it("returns an empty array when no active branches exist", async () => {
    mockBranchFindMany.mockResolvedValue([]);
    const result = await getBranchOptions();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});