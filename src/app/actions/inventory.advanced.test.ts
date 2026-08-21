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
  moveStockBatchBetweenBranches,
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
          findMany: (...a: unknown[]) => mockProductFindMany(...a),
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

  it("filters by branchId at where root without a stock predicate", async () => {
    mockProductFindMany.mockResolvedValue([]);
    await getProductsWithBranchStock({ branchId: 1 });
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventory: { some: { branchId: 1 } },
        }),
      })
    );
  });

  it("composes branchId and onlyWithStock at where root (AND)", async () => {
    mockProductFindMany.mockResolvedValue([]);
    await getProductsWithBranchStock({ branchId: 1, onlyWithStock: true });
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventory: {
            some: { branchId: 1, stock: { gt: 0 } },
          },
        }),
      })
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

// ===========================================================================
// moveStockBatchBetweenBranches — atomic multi-product transfer
// ===========================================================================
describe("moveStockBatchBetweenBranches (Fase 3) — atomic batch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("moves a valid batch with distinct quantities in a single transaction", async () => {
    // active branches (origen 1, destino 2)
    mockBranchFindFirst.mockResolvedValueOnce({ id: 1 });
    mockBranchFindFirst.mockResolvedValueOnce({ id: 2 });
    // both products active
    mockProductFindMany.mockResolvedValue([
      { id: 1, name: "Jabón" },
      { id: 2, name: "Shampoo" },
    ]);
    // origin stocks: A=10, B=15 ; dest stocks: A=0 (missing), B=3
    mockBranchInventoryFindUnique
      .mockResolvedValueOnce({ stock: 10 }) // origin A
      .mockResolvedValueOnce({ stock: 15 }) // origin B
      .mockResolvedValueOnce(null)           // dest A (no row)
      .mockResolvedValueOnce({ stock: 3 });  // dest B
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 0 });

    const result = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 2,
      performedBy: "u1",
      items: [
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 7 },
      ],
    });

    expect(result.success).toBe(true);
    // 4 upserts (2 per item: origin + dest) and 4 branchMovement.create
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(4);
    expect(mockBranchMovementCreate).toHaveBeenCalledTimes(4);

    // origin decrement (A: 10-3=7), dest increment (A: 0+3=3)
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId_productId: { branchId: 1, productId: 1 } },
        update: { stock: 7 },
        create: expect.objectContaining({ stock: 7 }),
      })
    );
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId_productId: { branchId: 2, productId: 1 } },
        update: { stock: 3 },
        create: expect.objectContaining({ stock: 3 }),
      })
    );

    // all 4 movements share the same reference and performedBy
    const movements = mockBranchMovementCreate.mock.calls.map((c) => c[0].data);
    expect(movements).toHaveLength(4);
    const refs = new Set(movements.map((m) => m.reference));
    expect(refs.size).toBe(1);
    expect([...refs][0]).toMatch(/^MOVE-/);
    for (const m of movements) expect(m.performedBy).toBe("u1");
    // 2 TRANSFER_OUT (origen) + 2 TRANSFER_IN (destino)
    const out = movements.filter((m) => m.movementType === "TRANSFER_OUT");
    const inn = movements.filter((m) => m.movementType === "TRANSFER_IN");
    expect(out).toHaveLength(2);
    expect(inn).toHaveLength(2);
  });

  it("aborts with full rollback when a later item lacks origin stock", async () => {
    mockBranchFindFirst.mockResolvedValueOnce({ id: 1 });
    mockBranchFindFirst.mockResolvedValueOnce({ id: 2 });
    mockProductFindMany.mockResolvedValue([
      { id: 1, name: "Jabón" },
      { id: 2, name: "Shampoo" },
    ]);
    // origin stocks: A=2 (insufficient for 5), B=10
    mockBranchInventoryFindUnique
      .mockResolvedValueOnce({ stock: 2 })  // origin A
      .mockResolvedValueOnce({ stock: 10 }); // origin B
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 0 });

    const result = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 2,
      performedBy: "u1",
      items: [
        { productId: 1, quantity: 5 },
        { productId: 2, quantity: 3 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Jabón");
    expect(result.error).toContain("Disponible: 2, Requerido: 5");
    // rollback total: no upserts, no movements
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
    expect(mockBranchMovementCreate).not.toHaveBeenCalled();
  });

  it("rejects sourceBranchId === destBranchId via zod without opening a transaction", async () => {
    const result = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 1,
      performedBy: "u1",
      items: [{ productId: 1, quantity: 2 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("distintas");
    expect(mockBranchFindFirst).not.toHaveBeenCalled();
  });

  it("rejects empty/duplicate items or zero quantity via zod without opening a transaction", async () => {
    const empty = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 2,
      performedBy: "u1",
      items: [],
    });
    expect(empty.success).toBe(false);
    expect(empty.error).toContain("Seleccioná al menos un producto");

    const dup = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 2,
      performedBy: "u1",
      items: [
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 3 },
      ],
    });
    expect(dup.success).toBe(false);
    expect(dup.error).toContain("duplicados");

    const zero = await moveStockBatchBetweenBranches({
      sourceBranchId: 1,
      destBranchId: 2,
      performedBy: "u1",
      items: [{ productId: 1, quantity: 0 }],
    });
    expect(zero.success).toBe(false);
    expect(zero.error).toContain("mayor a 0");

    expect(mockBranchFindFirst).not.toHaveBeenCalled();
  });
});
