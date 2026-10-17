/**
 * Unit tests for getExternalBranchInventory (src/app/actions/inventory.external.ts).
 *
 * Covers the external-branch-catalog delta (isPublic/isActive visibility checks):
 *   - public + active branch        -> catalog { code, name, stock, price } without id
 *   - non-public / inactive / missing branch -> { success: false } (no leak, all roles)
 *   - inactive products are excluded (Product.active filter at the query root)
 *   - public branch without inventory -> { success: true, data: [] }
 *   - invalid branchId (zod)        -> { success: false }
 *
 * Prisma is mocked following the branch.test.ts pattern. The mock of
 * product.findMany applies the where.active filter like the real DB so the
 * exclusion of inactive products is exercised through the action's query.
 */

import { getExternalBranchInventory } from "@/app/actions/inventory.external";

// ---------------------------------------------------------------------------
// Prisma mock factory (matches the pattern used across this codebase)
// ---------------------------------------------------------------------------
const mockBranchFindUnique = jest.fn();
const mockProductFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findUnique: (...args: unknown[]) => mockBranchFindUnique(...args),
    },
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
    },
  },
}));

type ProductFindManyArgs = {
  where?: {
    active?: boolean;
    inventory?: { some?: { branchId?: number } };
  };
  select?: Record<string, unknown> & {
    id?: boolean;
    inventory?: { where?: { branchId?: number }; select?: { stock?: boolean } };
  };
  orderBy?: unknown;
};

type BranchInventoryResult = {
  success: boolean;
  data?: { code: string; name: string; stock: number; price: number }[];
  /** Nombre de la sucursal: la página lo usa en el título del catálogo. */
  branchName?: string;
  error?: string;
};

/** All known products of the branch, used to simulate the DB active filter. */
const ALL_PRODUCTS = [
  { code: "A1", name: "Prod A", price: 150.5, active: true, inventory: [{ stock: 5 }] },
  { code: "B2", name: "Prod B inactivo", price: 80, active: false, inventory: [{ stock: 8 }] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchFindUnique.mockReset();
  mockProductFindMany.mockReset();
  // Default: the DB only returns products whose `active` flag matches the
  // where clause the action builds (active: true), like Prisma would.
  mockProductFindMany.mockImplementation((args: ProductFindManyArgs) => {
    const active = args?.where?.active;
    return Promise.resolve(ALL_PRODUCTS.filter((p) => p.active === active));
  });
});

// ===========================================================================
// Visibility: isPublic / isActive checks
// ===========================================================================
describe("getExternalBranchInventory visibility checks", () => {
  it("returns the catalog for a public and active branch (code, name, stock, price; no id)", async () => {
    mockBranchFindUnique.mockResolvedValue({ name: "Centro", isPublic: true, isActive: true });

    const result = (await getExternalBranchInventory({
      branchId: 39,
    })) as BranchInventoryResult;

    expect(result.success).toBe(true);
    // El nombre de la sucursal se devuelve aparte: la página lo usa en el título.
    expect(result.branchName).toBe("Centro");
    // Exact contract: no id, no authUserId, no email in the payload
    expect(result.data).toEqual([
      { code: "A1", name: "Prod A", stock: 5, price: 150.5 },
    ]);

    // Visibility check runs first with a minimal select
    expect(mockBranchFindUnique).toHaveBeenCalledWith({
      where: { id: 39 },
      select: { name: true, isPublic: true, isActive: true },
    });

    // Query contract: active filter at the root, inventory scoped to the
    // branch, ordered by name asc, and no id in the root select
    const call = mockProductFindMany.mock.calls[0][0] as ProductFindManyArgs;
    expect(call.where?.active).toBe(true);
    expect(call.where?.inventory?.some?.branchId).toBe(39);
    expect(call.select?.inventory?.where?.branchId).toBe(39);
    expect(call.select?.inventory?.select).toEqual({ stock: true });
    expect(call.select?.id).toBeUndefined();
    expect(call.orderBy).toEqual({ name: "asc" });
  });

  it("returns { success: false } for a non-public branch (isPublic=false)", async () => {
    mockBranchFindUnique.mockResolvedValue({ isPublic: false, isActive: true });

    const result = await getExternalBranchInventory({ branchId: 39 });

    // Identical shape to the other failure cases: no error message that
    // reveals the reason (no existence/visibility leak)
    expect(result).toEqual({ success: false });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it("returns { success: false } for an inactive branch (isActive=false)", async () => {
    mockBranchFindUnique.mockResolvedValue({ isPublic: true, isActive: false });

    const result = await getExternalBranchInventory({ branchId: 39 });

    expect(result).toEqual({ success: false });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it("returns { success: false } for a non-existent branch (same shape, no leak)", async () => {
    mockBranchFindUnique.mockResolvedValue(null);

    const result = await getExternalBranchInventory({ branchId: 39 });

    expect(result).toEqual({ success: false });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it("excludes inactive products even when they have stock in the branch", async () => {
    mockBranchFindUnique.mockResolvedValue({ isPublic: true, isActive: true });

    const result = (await getExternalBranchInventory({
      branchId: 39,
    })) as BranchInventoryResult;

    expect(result.success).toBe(true);
    // The mock applies the where.active filter like the DB: only "Prod A"
    // (active, stock 5) is returned; "Prod B inactivo" (stock 8) is filtered out
    expect(result.data).toEqual([
      { code: "A1", name: "Prod A", stock: 5, price: 150.5 },
    ]);

    const call = mockProductFindMany.mock.calls[0][0] as ProductFindManyArgs;
    expect(call.where?.active).toBe(true);
  });

  it("returns { success: true, data: [] } for a public branch without inventory", async () => {
    mockBranchFindUnique.mockResolvedValue({ isPublic: true, isActive: true });
    mockProductFindMany.mockResolvedValue([]);

    const result = await getExternalBranchInventory({ branchId: 39 });

    expect(result).toEqual({ success: true, data: [] });
  });

  it("returns { success: false } for an invalid branchId (zod)", async () => {
    const result = await getExternalBranchInventory({ branchId: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal inválida");
    // The DB is never touched: validation fails before the visibility check
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});