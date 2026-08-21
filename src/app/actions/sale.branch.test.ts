/**
 * Integration tests for registerSale branch association (HU2)
 *
 * Covers the delta in openspec/changes/HU2/specs/sales-management/spec.md:
 *   - branchId is REQUIRED on createSale
 *   - inventory is deducted from the specified branch's BranchInventory
 *   - insufficient stock at a specific branch is rejected (per-branch guard)
 *   - stock at one branch is NOT affected by a sale at another branch (isolation)
 *
 * These tests complement the legacy sale.test.ts and focus exclusively on the
 * HU2 branch-association behavior.
 */

import { registerSale } from "@/app/actions/sale";

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------
const mockBranchFindFirst = jest.fn();
const mockProductFindUnique = jest.fn();
const mockBranchInventoryUpdateMany = jest.fn();
const mockSaleCreate = jest.fn();
const mockSaleItemCreateMany = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockCustomerUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: { findFirst: (...args: unknown[]) => mockBranchFindFirst(...args) },
    product: { findUnique: (...args: unknown[]) => mockProductFindUnique(...args) },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        sale: { create: (...args: unknown[]) => mockSaleCreate(...args) },
        saleItem: {
          createMany: (...args: unknown[]) => mockSaleItemCreateMany(...args),
          findMany: (...args: unknown[]) => mockSaleItemFindMany(...args),
        },
        branchInventory: {
          updateMany: (...args: unknown[]) => mockBranchInventoryUpdateMany(...args),
        },
        customer: { update: (...args: unknown[]) => mockCustomerUpdate(...args) },
      };
      return callback(tx);
    }),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const baseValidSale = {
  items: [{ productId: 1, price: 100, quantity: 3 }],
  branchId: 1,
  amountPaid: 300,
};

describe("registerSale branch association (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique.mockResolvedValue({ id: 1, name: "Producto A" });
  });

  it("rejects a sale without branchId (validation error)", async () => {
    const result = await registerSale({
      items: [{ productId: 1, price: 100, quantity: 3 }],
      // branchId intentionally omitted
    } as unknown);

    expect(result.success).toBe(false);
    // branchId coerced from undefined -> NaN; Zod rejects with a validation error.
    // The spec requires the action to reject missing branchId; assert rejection + no mutation.
    expect(result.error).toBeTruthy();
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("rejects when the branch is invalid or inactive", async () => {
    mockBranchFindFirst.mockResolvedValue(null);

    const result = await registerSale({
      ...baseValidSale,
      branchId: 99,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal");
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("creates a sale with branchId and decrements that branch's BranchInventory", async () => {
    mockSaleCreate.mockResolvedValue({
      id: 10,
      totalAmount: 300,
      amountPaid: 300,
      pendingBalance: 0,
    });
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mockSaleItemFindMany.mockResolvedValue([
      { id: 1, productId: 1, price: 100, quantity: 3 },
    ]);

    const result = await registerSale(baseValidSale);

    expect(result.success).toBe(true);

    // Sale header must record branchId=1
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: 1 }),
      })
    );

    // Stock check uses a conditional updateMany scoped to branchId=1 + productId=1
    expect(mockBranchInventoryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 1,
          productId: 1,
          stock: { gte: 3 },
        },
        data: expect.objectContaining({
          stock: { decrement: 3 },
        }),
      })
    );
  });

  it("rejects a sale when the branch has insufficient stock (per-branch guard)", async () => {
    // updateMany returns count 0 => no row had enough stock for the sale
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 0 });

    const result = await registerSale({
      items: [{ productId: 1, price: 100, quantity: 5 }],
      branchId: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    // Sale must NOT be created when stock is insufficient (fail-fast before header)
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("does NOT deduct from another branch's inventory (cross-branch isolation)", async () => {
    // A sale at Branch 1 must only touch the BranchInventory row whose
    // where clause includes branchId=1.
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mockSaleCreate.mockResolvedValue({
      id: 11,
      totalAmount: 200,
      amountPaid: 200,
      pendingBalance: 0,
    });
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockSaleItemFindMany.mockResolvedValue([]);

    const result = await registerSale({
      items: [{ productId: 1, price: 100, quantity: 2 }],
      branchId: 1,
    });

    expect(result.success).toBe(true);

    // The where clause locks the deduction to branchId=1, never another branch
    const updateCall = mockBranchInventoryUpdateMany.mock.calls[0][0];
    expect(updateCall.where.branchId).toBe(1);
    expect(updateCall.where.productId).toBe(1);
  });

  it("deducts stock from the SPECIFIC branch the sale targets, not a sibling branch", async () => {
    // Two branches carry the same product. A sale at Branch 1 must only touch
    // the BranchInventory row whose where clause includes branchId=1.
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mockSaleCreate.mockResolvedValue({
      id: 12,
      totalAmount: 500,
      amountPaid: 500,
      pendingBalance: 0,
    });
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockSaleItemFindMany.mockResolvedValue([]);

    const result = await registerSale({
      items: [{ productId: 7, price: 100, quantity: 5 }],
      branchId: 1,
    });

    expect(result.success).toBe(true);

    // The deduction must reference branchId=1 and productId=7
    expect(mockBranchInventoryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, productId: 7, stock: { gte: 5 } },
        data: expect.objectContaining({ stock: { decrement: 5 } }),
      })
    );

    // Sibling branch (id=2) inventory row must never be touched
    const updateArgs = mockBranchInventoryUpdateMany.mock.calls[0][0] as {
      where: { branchId: number; productId: number };
    };
    expect(updateArgs.where.branchId).not.toBe(2);
  });
});
