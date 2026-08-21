/**
 * Integration tests for registerPurchase branch association (HU2)
 *
 * Covers the delta in openspec/changes/HU2/specs/purchase-management/spec.md:
 *   - branchId is REQUIRED on createPurchase
 *   - received inventory is added to the specified branch's BranchInventory
 *   - missing branchId is rejected with a validation error
 *
 * These tests complement the legacy purchase.test.ts and focus exclusively on
 * the HU2 branch-association behavior, so they do not disturb pre-existing
 * branch-unaware assertions.
 */

import { registerPurchase } from "@/app/actions/purchase";

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------
const mockBranchFindFirst = jest.fn();
const mockPurchaseCreate = jest.fn();
const mockPurchaseItemCreateMany = jest.fn();
const mockPurchaseItemFindMany = jest.fn();
const mockBranchInventoryUpsert = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findFirst: (...args: unknown[]) => mockBranchFindFirst(...args),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        purchase: { create: (...args: unknown[]) => mockPurchaseCreate(...args) },
        purchaseItem: {
          createMany: (...args: unknown[]) => mockPurchaseItemCreateMany(...args),
          findMany: (...args: unknown[]) => mockPurchaseItemFindMany(...args),
        },
        branchInventory: {
          upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args),
        },
      };
      return callback(tx);
    }),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("registerPurchase branch association (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default the branch exists and is active
    mockBranchFindFirst.mockResolvedValue({ id: 2 });
  });

  it("rejects a purchase without branchId (validation error)", async () => {
    const result = await registerPurchase({
      items: [{ productId: 1, price: 100, quantity: 5 }],
      // branchId intentionally omitted
    } as unknown);

    expect(result.success).toBe(false);
    // branchId coerced from undefined -> NaN; Zod rejects with a validation error.
    // The spec requires the action to reject missing branchId; the exact wording
    // depends on Zod's coercion message, so assert the rejection + no mutation.
    expect(result.error).toBeTruthy();
    expect(mockPurchaseCreate).not.toHaveBeenCalled();
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
  });

  it("rejects a purchase with a non-positive branchId", async () => {
    const result = await registerPurchase({
      items: [{ productId: 1, price: 100, quantity: 5 }],
      branchId: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("sucursal");
  });

  it("rejects when the branch does not exist or is inactive", async () => {
    mockBranchFindFirst.mockResolvedValue(null);

    const result = await registerPurchase({
      items: [{ productId: 1, price: 100, quantity: 5 }],
      branchId: 99,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal");
    expect(mockPurchaseCreate).not.toHaveBeenCalled();
  });

  it("creates a purchase with branchId and increments that branch's BranchInventory", async () => {
    mockPurchaseCreate.mockResolvedValue({ id: 42, totalAmount: 500 });
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 1 });
    mockPurchaseItemFindMany.mockResolvedValue([
      { id: 1, productId: 1, price: 100, quantity: 5 },
    ]);

    const result = await registerPurchase({
      items: [{ productId: 1, price: 100, quantity: 5 }],
      branchId: 2,
    });

    expect(result.success).toBe(true);

    // Purchase header must record branchId=2
    expect(mockPurchaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: 2 }),
      })
    );

    // BranchInventory upsert must target the SAME branchId via composite key
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId_productId: { branchId: 2, productId: 1 },
        },
        create: expect.objectContaining({ branchId: 2, productId: 1, stock: 5 }),
        update: expect.objectContaining({
          stock: { increment: 5 },
        }),
      })
    );
  });

  it("increments BranchInventory per item when multiple items are purchased", async () => {
    mockPurchaseCreate.mockResolvedValue({ id: 43, totalAmount: 700 });
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 2 });
    mockPurchaseItemFindMany.mockResolvedValue([]);

    const result = await registerPurchase({
      items: [
        { productId: 1, price: 100, quantity: 5 },
        { productId: 2, price: 200, quantity: 1 },
      ],
      branchId: 3,
    });

    expect(result.success).toBe(true);
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(2);

    // Verify each upsert used branchId=3 in its composite key
    const calls = mockBranchInventoryUpsert.mock.calls;
    expect(calls[0][0]).toEqual(
      expect.objectContaining({
        where: { branchId_productId: { branchId: 3, productId: 1 } },
      })
    );
    expect(calls[1][0]).toEqual(
      expect.objectContaining({
        where: { branchId_productId: { branchId: 3, productId: 2 } },
      })
    );
  });
});
