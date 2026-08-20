/**
 * Unit/Integration tests for Advanced Inventory operations (Fase 3)
 *
 * Covers:
 *   - getProductsWithBranchStock (join Product + BranchInventory + Category)
 *   - assignStockToBranch (upsert + ADJUSTMENT movement)
 *   - moveStockBetweenBranches (two-row BranchMovement pair + non-negative guard)
 *   - getBranchMovements (filters + join Branch/Product)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fase3-inventory-branch-interfaces/specs/inventory-ui/spec.md
 *   - openspec/changes/fase3-inventory-branch-interfaces/design.md (Stock Movement Flow)
 */

import {
  getProductsWithBranchStock,
  assignStockToBranch,
  moveStockBetweenBranches,
  getBranchMovements,
} from "@/app/actions/inventory";

const mockBranchFindFirst = jest.fn();
const mockProductFindUnique = jest.fn();
const mockProductFindMany = jest.fn();
const mockBranchInventoryFindUnique = jest.fn();
const mockBranchInventoryUpsert = jest.fn();
const mockBranchMovementCreate = jest.fn();
const mockBranchMovementFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findFirst: (...args: unknown[]) => mockBranchFindFirst(...args),
    },
    product: {
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
    },
    branchInventory: {
      findUnique: (...args: unknown[]) => mockBranchInventoryFindUnique(...args),
      upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args),
    },
    branchMovement: {
      create: (...args: unknown[]) => mockBranchMovementCreate(...args),
      findMany: (...args: unknown[]) => mockBranchMovementFindMany(...args),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        branch: { findFirst: (...a: unknown[]) => mockBranchFindFirst(...a) },
        product: {
          findUnique: (...a: unknown[]) => mockProductFindUnique(...a),
        },
        branchInventory: {
          findUnique: (...a: unknown[]) => mockBranchInventoryFindUnique(...a),
          upsert: (...a: unknown[]) => mockBranchInventoryUpsert(...a),
        },
        branchMovement: {
          create: (...a: unknown[]) => mockBranchMovementCreate(...a),
        },
      };
      return callback(tx);
    }),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// ===========================================================================
// getProductsWithBranchStock
// ===========================================================================
describe("getProductsWithBranchStock (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns products joined with inventory and category", async () => {
    mockProductFindMany.mockResolvedValue([
      {
        id: 1,
        name: "Jabón",
        code: "AA000",
        active: true,
        category: { id: 1, name: "General" },
        inventory: [{ branchId: 1, stock: 5, branch: { id: 1, name: "Depósito" } }],
      },
    ]);

    const result = await getProductsWithBranchStock({});

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.category?.name).toBe("General");
  });

  it("filters by categoryId when passed", async () => {
    mockProductFindMany.mockResolvedValue([]);
    await getProductsWithBranchStock({ categoryId: 3 });
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ categoryId: 3 }) })
    );
  });
});

// ===========================================================================
// assignStockToBranch
// ===========================================================================
describe("assignStockToBranch (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserts BranchInventory with newStock when change positive", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 10 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 25 });

    const result = await assignStockToBranch({
      productId: 1,
      branchId: 2,
      quantity: 15,
      performedBy: "admin",
    });

    expect(result.success).toBe(true);
    expect(result.data?.newStock).toBe(25);
    expect(mockBranchMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "ADJUSTMENT",
          quantity: 15,
          performedBy: "admin",
        }),
      })
    );
  });

  it("rejects when resulting stock would be negative", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 1 });

    const result = await assignStockToBranch({
      productId: 1,
      branchId: 2,
      quantity: -5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
  });

  it("skips BranchMovement when performedBy is omitted", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 0 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 5 });

    await assignStockToBranch({ productId: 1, branchId: 2, quantity: 5 });

    expect(mockBranchMovementCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// moveStockBetweenBranches — TWO-ROW BranchMovement pattern
// ===========================================================================
describe("moveStockBetweenBranches (Fase 3) — two-row movement", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects when origen === destino (refine)", async () => {
    const result = await moveStockBetweenBranches({
      productId: 1,
      sourceBranchId: 1,
      destBranchId: 1,
      quantity: 5,
      performedBy: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("distintas");
  });

  it("moves stock and inserts TRANSFER_OUT + TRANSFER_IN with same reference", async () => {
    // branch active guards
    mockBranchFindFirst.mockResolvedValueOnce({ id: 1 });
    mockBranchFindFirst.mockResolvedValueOnce({ id: 2 });
    // product exists and active
    mockProductFindUnique.mockResolvedValue({ id: 1, active: true, name: "Jabón" });
    // origen stock = 10, destino = 3
    mockBranchInventoryFindUnique
      .mockResolvedValueOnce({ stock: 10 }) // origin lookup (first call)
      .mockResolvedValueOnce({ stock: 3 }); // dest lookup (second call)
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 5 });

    const result = await moveStockBetweenBranches({
      productId: 1,
      sourceBranchId: 1,
      destBranchId: 2,
      quantity: 4,
      performedBy: "admin",
    });

    expect(result.success).toBe(true);
    expect(result.data?.quantity).toBe(4);

    // Both branchMovement.create calls must happen with matching reference
    expect(mockBranchMovementCreate).toHaveBeenCalledTimes(2);
    const firstCall = mockBranchMovementCreate.mock.calls[0][0].data;
    const secondCall = mockBranchMovementCreate.mock.calls[1][0].data;
    expect(firstCall.movementType).toBe("TRANSFER_OUT");
    expect(firstCall.branchId).toBe(1);
    expect(firstCall.quantity).toBe(4);
    expect(secondCall.movementType).toBe("TRANSFER_IN");
    expect(secondCall.branchId).toBe(2);
    expect(secondCall.quantity).toBe(4);
    // Same reference groups both halves
    expect(firstCall.reference).toBe(secondCall.reference);
    expect(firstCall.reference).toMatch(/^MOVE-/);
    expect(firstCall.performedBy).toBe("admin");
    expect(secondCall.performedBy).toBe("admin");
  });

  it("rejects when stock in origin is insufficient", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique.mockResolvedValue({ id: 1, active: true, name: "Jabón" });
    mockBranchInventoryFindUnique.mockResolvedValueOnce({ stock: 2 }); // origin

    const result = await moveStockBetweenBranches({
      productId: 1,
      sourceBranchId: 1,
      destBranchId: 2,
      quantity: 5,
      performedBy: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente en origen");
  });

  it("rejects when source branch is inactive", async () => {
    mockBranchFindFirst.mockResolvedValue(null);

    const result = await moveStockBetweenBranches({
      productId: 1,
      sourceBranchId: 1,
      destBranchId: 2,
      quantity: 2,
      performedBy: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("origen inactiva");
  });
});

// ===========================================================================
// getBranchMovements
// ===========================================================================
describe("getBranchMovements (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns movements joined with branch and product", async () => {
    mockBranchMovementFindMany.mockResolvedValue([
      {
        id: 1,
        productId: 1,
        branchId: 2,
        movementType: "TRANSFER_IN",
        quantity: 3,
        reference: "MOVE-1",
        performedBy: "admin",
        createdAt: new Date(),
        branch: { id: 2, name: "Sucursal Sur" },
        product: { id: 1, name: "Jabón" },
      },
    ]);

    const result = await getBranchMovements({ branchId: 2 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.branch?.name).toBe("Sucursal Sur");
    expect(mockBranchMovementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 2 }) })
    );
  });

  it("accepts empty filters and returns all movements (capped at 200)", async () => {
    mockBranchMovementFindMany.mockResolvedValue([]);
    await getBranchMovements();
    expect(mockBranchMovementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });
});
