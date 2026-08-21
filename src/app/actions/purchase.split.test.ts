/**
 * Unit/Integration tests for createPurchaseWithBranchSplit (Fase 3)
 *
 * Covers:
 *   - single-line purchase split behaves like a normal register
 *   - multi-branch split: increments BranchInventory per branchId + ENTRY movements
 *   - validates branches active and products active
 *   - Zod validation (items array min 1, positive price/quantity)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fase3-inventory-branch-interfaces/specs/purchase-with-branch-split/spec.md
 */

import { createPurchaseWithBranchSplit } from "@/app/actions/purchase";

const mockBranchFindMany = jest.fn();
const mockProductFindMany = jest.fn();
const mockPurchaseCreate = jest.fn();
const mockPurchaseItemCreate = jest.fn();
const mockBranchInventoryUpsert = jest.fn();
const mockBranchMovementCreate = jest.fn();
const mockPurchaseItemFindMany = jest.fn();

// Default $transaction implementation (used by non-retry tests). Retry tests
// override it with mockRejectedValueOnce(...) and fall back to this impl.
const defaultTransaction = async (callback: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    purchase: { create: (...a: unknown[]) => mockPurchaseCreate(...a) },
    purchaseItem: {
      create: (...a: unknown[]) => mockPurchaseItemCreate(...a),
      findMany: (...a: unknown[]) => mockPurchaseItemFindMany(...a),
    },
    branchInventory: {
      upsert: (...a: unknown[]) => mockBranchInventoryUpsert(...a),
    },
    branchMovement: {
      create: (...a: unknown[]) => mockBranchMovementCreate(...a),
    },
  };
  return callback(tx);
};

const mockTransaction = jest.fn(defaultTransaction);

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: { findMany: (...a: unknown[]) => mockBranchFindMany(...a) },
    product: { findMany: (...a: unknown[]) => mockProductFindMany(...a) },
    branchInventory: {
      upsert: (...a: unknown[]) => mockBranchInventoryUpsert(...a),
    },
    branchMovement: {
      create: (...a: unknown[]) => mockBranchMovementCreate(...a),
    },
    $transaction: (callback: (tx: unknown) => Promise<unknown>) => mockTransaction(callback),
  },
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

describe("createPurchaseWithBranchSplit (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects empty items array (Zod)", async () => {
    const result = await createPurchaseWithBranchSplit({ items: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain("al menos un item");
  });

  it("rejects when a branch is inactive", async () => {
    // branch 2 invalid
    mockBranchFindMany.mockResolvedValue([{ id: 1 }]); // only branch 1 active

    const result = await createPurchaseWithBranchSplit({
      items: [
        { productId: 1, branchId: 1, quantity: 2, price: 5 },
        { productId: 1, branchId: 2, quantity: 3, price: 5 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal 2");
  });

  it("rejects when a product is inactive", async () => {
    mockBranchFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockProductFindMany.mockResolvedValue([
      { id: 1, active: true, name: "A" },
      { id: 2, active: false, name: "Desactivado" },
    ]);

    const result = await createPurchaseWithBranchSplit({
      items: [{ productId: 2, branchId: 1, quantity: 1, price: 5 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("inactivo");
  });

  it("creates a multi-branch split: head branchId = first, increments per line, ENTRY movements", async () => {
    mockBranchFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockProductFindMany.mockResolvedValue([
      { id: 1, active: true, name: "Jabón" },
      { id: 2, active: true, name: "Shampoo" },
    ]);
    mockPurchaseCreate.mockResolvedValue({ id: 99, branchId: 1, totalAmount: 35 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 5 });
    mockPurchaseItemFindMany.mockResolvedValue([
      { id: 1, product: { id: 1, name: "Jabón", code: "AA000" } },
      { id: 2, product: { id: 2, name: "Shampoo", code: "BB000" } },
    ]);

    const result = await createPurchaseWithBranchSplit({
      items: [
        { productId: 1, branchId: 1, quantity: 2, price: 5 }, // head branch
        { productId: 2, branchId: 2, quantity: 5, price: 5 }, // different branch
      ],
      performedBy: "admin",
    });

    expect(result.success).toBe(true);
    // Cabecera lleva branchId de la primera línea
    expect(mockPurchaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 1 }) })
    );
    // 2 upserts to BranchInventory (uno por línea, distinto branchId)
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(2);
    const firstUpsert = mockBranchInventoryUpsert.mock.calls[0][0];
    const secondUpsert = mockBranchInventoryUpsert.mock.calls[1][0];
    expect(firstUpsert.where.branchId_productId).toEqual({
      branchId: 1,
      productId: 1,
    });
    expect(secondUpsert.where.branchId_productId).toEqual({
      branchId: 2,
      productId: 2,
    });
    // 2 ENTRY BranchMovement rows
    expect(mockBranchMovementCreate).toHaveBeenCalledTimes(2);
    expect(mockBranchMovementCreate.mock.calls[0][0].data.movementType).toBe("ENTRY");
    expect(mockBranchMovementCreate.mock.calls[0][0].data.reference).toBe("PURCHASE-99");
  });
});

describe("createPurchaseWithBranchSplit retry (FIX-FASE4 issue 3)", () => {
  let consoleErrorSpy: jest.SpyInstance;

  const setupValidPurchase = () => {
    mockBranchFindMany.mockResolvedValue([{ id: 1 }]);
    mockProductFindMany.mockResolvedValue([{ id: 1, active: true, name: "Jabón" }]);
    mockPurchaseCreate.mockResolvedValue({ id: 1, branchId: 1, totalAmount: 10 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 1 });
    mockPurchaseItemFindMany.mockResolvedValue([
      { id: 1, product: { id: 1, name: "Jabón", code: "AA000" } },
    ]);
  };

  const validInput = {
    items: [{ productId: 1, branchId: 1, quantity: 1, price: 10 }],
  };

  const transientP2024 = () =>
    Object.assign(new Error("Transaction already closed"), { code: "P2024" });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    // Reset queued rejections + implementations so retry tests start clean
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(defaultTransaction);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("retries once when the first attempt fails with a transient P2024 and succeeds", async () => {
    setupValidPurchase();
    mockTransaction.mockRejectedValueOnce(transientP2024());

    const result = await createPurchaseWithBranchSplit(validInput);

    expect(result.success).toBe(true);
    // 2 attempts total: first fails (transient), second succeeds
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    // First failure is logged with the raw error + validated input shape
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "createPurchaseWithBranchSplit: primer intento falló, reintentando",
      expect.objectContaining({
        code: "P2024",
        branchIds: [1],
        productIds: [1],
      })
    );
  });

  it("retries twice (3 attempts total) when transient errors keep occurring, then succeeds", async () => {
    setupValidPurchase();
    mockTransaction
      .mockRejectedValueOnce(transientP2024())
      .mockRejectedValueOnce(transientP2024());

    const result = await createPurchaseWithBranchSplit(validInput);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });

  it("returns a generic error after 3 consecutive transient failures", async () => {
    setupValidPurchase();
    mockTransaction.mockRejectedValue(transientP2024());

    const result = await createPurchaseWithBranchSplit(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al registrar la compra con distribución");
    expect(mockTransaction).toHaveBeenCalledTimes(3);
    // First failure is logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "createPurchaseWithBranchSplit: primer intento falló, reintentando",
      expect.objectContaining({ code: "P2024" })
    );
  });

  it("does not retry non-transient errors (P2002)", async () => {
    setupValidPurchase();
    mockTransaction.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const result = await createPurchaseWithBranchSplit(validInput);

    expect(result.success).toBe(false);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
