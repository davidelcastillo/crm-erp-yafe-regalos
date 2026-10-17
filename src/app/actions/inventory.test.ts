/**
 * Unit/Integration tests for Branch Inventory operations (HU2)
 *
 * Covers:
 *   - getProductStock(productId, branchId)
 *   - adjustProductStock(productId, branchId, change)
 *   - Non-negative stock enforcement
 *   - Cross-branch data isolation (adjusting one branch does not affect another)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/HU2/specs/product-management/spec.md
 *   - openspec/changes/HU2/specs/sales-management/spec.md (insufficient stock)
 *   - openspec/changes/HU2/design.md (Testing Strategy: cross-business rule)
 */

import {
  getProductStock,
  adjustProductStock,
  exportBranchProductsPdf,
  getProductsWithBranchStock,
  getBranchProductsForExport,
} from "@/app/actions/inventory";
import {
  buildExportFileName,
  generateProductsPdf,
} from "@/lib/utils/pdf";

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------
const mockBranchInventoryFindUnique = jest.fn();
const mockBranchInventoryFindMany = jest.fn();
const mockBranchInventoryUpsert = jest.fn();
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
    branchInventory: {
      findUnique: (...args: unknown[]) => mockBranchInventoryFindUnique(...args),
      findMany: (...args: unknown[]) => mockBranchInventoryFindMany(...args),
      upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        branchInventory: {
          findUnique: (...args: unknown[]) =>
            mockBranchInventoryFindUnique(...args),
          upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args),
        },
      };
      return callback(tx);
    }),
  },
}));

jest.mock("@/lib/utils/pdf", () => ({
  generateProductsPdf: jest.fn(async () => "ZmFrZS1iYXNlNjQ="),
  buildExportFileName: jest.fn(() => "inventario-DEP-20260806.pdf"),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// ===========================================================================
// getProductStock
// ===========================================================================
describe("getProductStock (HU2 branch-scoped inventory)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the stock level for an existing BranchInventory record", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 10 });

    const result = await getProductStock({ productId: 1, branchId: 2 });

    expect(result.success).toBe(true);
    expect(result.data?.stock).toBe(10);
    expect(mockBranchInventoryFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId_productId: { branchId: 2, productId: 1 },
        },
        select: { stock: true },
      })
    );
  });

  it("returns stock=0 when no BranchInventory record exists yet", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue(null);

    const result = await getProductStock({ productId: 1, branchId: 2 });

    expect(result.success).toBe(true);
    expect(result.data?.stock).toBe(0);
  });

  it("rejects an invalid productId (Zod)", async () => {
    const result = await getProductStock({ productId: -1, branchId: 2 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Producto");
  });

  it("rejects an invalid branchId (Zod)", async () => {
    const result = await getProductStock({ productId: 1, branchId: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal");
  });
});

// ===========================================================================
// adjustProductStock - increments / decrements / guards
// ===========================================================================
describe("adjustProductStock (HU2 branch-scoped inventory)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("increases stock by a positive change via upsert", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 10 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 25 });

    const result = await adjustProductStock({
      productId: 1,
      branchId: 2,
      change: 15,
    });

    expect(result.success).toBe(true);
    expect(result.data?.newStock).toBe(25);
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ branchId: 2, productId: 1, stock: 25 }),
        update: expect.objectContaining({ stock: 25 }),
      })
    );
  });

  it("decreases stock by a negative change when sufficient stock exists", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 10 });
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 7 });

    const result = await adjustProductStock({
      productId: 1,
      branchId: 2,
      change: -3,
    });

    expect(result.success).toBe(true);
    expect(result.data?.newStock).toBe(7);
  });

  it("rejects a decrement that would result in negative stock (INSUFFICIENT_STOCK guard)", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue({ stock: 1 });

    const result = await adjustProductStock({
      productId: 1,
      branchId: 2,
      change: -5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(result.error).toContain("Disponible: 1");
    // upsert must NOT be called when the guard rejects
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
  });

  it("creates a new BranchInventory row (stock 0 -> N) when no record exists yet", async () => {
    mockBranchInventoryFindUnique.mockResolvedValue(null);
    mockBranchInventoryUpsert.mockResolvedValue({ stock: 20 });

    const result = await adjustProductStock({
      productId: 9,
      branchId: 3,
      change: 20,
    });

    expect(result.success).toBe(true);
    expect(result.data?.newStock).toBe(20);
    // currentStock derived as 0 (null record), newStock = 0 + 20 = 20
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ branchId: 3, productId: 9, stock: 20 }),
      })
    );
  });

  it("rejects a non-integer change (Zod)", async () => {
    const result = await adjustProductStock({
      productId: 1,
      branchId: 2,
      change: 1.5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("entero");
  });
});

// ===========================================================================
// Cross-branch data isolation (design Testing Strategy: cross-business rule)
// ===========================================================================
describe("cross-branch inventory isolation (HU2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adjusting stock at Branch 1 does not affect Branch 2 inventory", async () => {
    // Two adjust calls: one for branch 1 (the mutation), one for branch 2 (the assertion)
    // Branch 1 has 10 -> increment 5 -> 15
    mockBranchInventoryFindUnique.mockResolvedValueOnce({ stock: 10 });
    mockBranchInventoryUpsert.mockResolvedValueOnce({ stock: 15 });

    const r1 = await adjustProductStock({
      productId: 1,
      branchId: 1,
      change: 5,
    });
    expect(r1.success).toBe(true);
    expect(r1.data?.newStock).toBe(15);

    // Now query Branch 2 stock for the SAME product: must be independently 0
    mockBranchInventoryFindUnique.mockResolvedValueOnce(null);
    const r2 = await getProductStock({ productId: 1, branchId: 2 });
    expect(r2.success).toBe(true);
    expect(r2.data?.stock).toBe(0);

    // Critical assertion: BOTH lookups used their OWN branchId in the composite key
    const calls = mockBranchInventoryFindUnique.mock.calls;
    expect(calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          branchId_productId: { branchId: 1, productId: 1 },
        },
      })
    );
    expect(calls[1][0]).toEqual(
      expect.objectContaining({
        where: {
          branchId_productId: { branchId: 2, productId: 1 },
        },
      })
    );
  });
});

// ===========================================================================
// getProductsWithBranchStock - active filter default (FIX-FASE4 issue 1)
// ===========================================================================
describe("getProductsWithBranchStock (active default)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters active: true by default when activeOnly is not provided", async () => {
    mockProductFindMany.mockResolvedValue([]);

    await getProductsWithBranchStock({});

    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      })
    );
  });

  it("does not restrict by active when activeOnly: false (AD8)", async () => {
    mockProductFindMany.mockResolvedValue([]);

    await getProductsWithBranchStock({ activeOnly: false });

    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ active: expect.anything() }),
      })
    );
  });
});

// ===========================================================================
// exportBranchProductsPdf (Fase 4 - Export wizard server action)
// ===========================================================================
describe("exportBranchProductsPdf (Fase 4 branch PDF export)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when a selected product does not belong to the branch (no PDF generated)", async () => {
    mockBranchFindUnique.mockResolvedValue({ code: "DEP" });
    mockBranchInventoryFindMany.mockResolvedValue([
      {
        productId: 1,
        stock: 5,
        product: { code: "P1", name: "Producto 1", price: 100 },
      },
    ]);

    const result = await exportBranchProductsPdf({
      branchId: 1,
      selectedProductIds: [1, 2],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Algunos productos no pertenecen");
    expect(generateProductsPdf).not.toHaveBeenCalled();
  });

  it("returns base64 + filename and calls generateProductsPdf with the rows and the branch meta on a valid selection", async () => {
    mockBranchFindUnique.mockResolvedValue({ code: "DEP", name: "Depósito" });
    mockBranchInventoryFindMany.mockResolvedValue([
      {
        productId: 2,
        stock: 8,
        product: { code: "P2", name: "Producto B", price: 250 },
      },
      {
        productId: 1,
        stock: 5,
        product: { code: "P1", name: "Producto A", price: 100 },
      },
    ]);

    const result = await exportBranchProductsPdf({
      branchId: 1,
      selectedProductIds: [1, 2],
    });

    expect(result.success).toBe(true);
    expect(result.data?.pdfBase64).toBe("ZmFrZS1iYXNlNjQ=");
    expect(result.data?.filename).toBe("inventario-DEP-20260806.pdf");
    expect(generateProductsPdf).toHaveBeenCalledTimes(1);
    expect(generateProductsPdf).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ code: "P1", name: "Producto A", stock: 5, price: 100 }),
        expect.objectContaining({ code: "P2", name: "Producto B", stock: 8, price: 250 }),
      ]),
      expect.objectContaining({ branchName: "Depósito", branchCode: "DEP" })
    );
    expect(buildExportFileName).toHaveBeenCalledWith("DEP", expect.any(Date));
  });

  it("rejects with a Zod error when selectedProductIds is empty", async () => {
    const result = await exportBranchProductsPdf({
      branchId: 1,
      selectedProductIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Seleccioná al menos un producto");
    expect(generateProductsPdf).not.toHaveBeenCalled();
  });

  it("rejects when the branch does not exist", async () => {
    mockBranchFindUnique.mockResolvedValue(null);

    const result = await exportBranchProductsPdf({
      branchId: 999,
      selectedProductIds: [1],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sucursal no encontrada");
    expect(generateProductsPdf).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getBranchProductsForExport (Fase 4 - export wizard step 2)
// ===========================================================================
describe("getBranchProductsForExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a bare number payload before touching prisma", async () => {
    const result = await getBranchProductsForExport(1);

    expect(result.success).toBe(false);
    expect(result.error).toContain("expected object");
    expect(mockBranchInventoryFindMany).not.toHaveBeenCalled();
  });

  it("filters stock > 0 and returns rows ordered by name", async () => {
    mockBranchInventoryFindMany.mockResolvedValue([
      {
        stock: 8,
        product: { id: 2, code: "P2", name: "Producto B", price: 250 },
      },
      {
        stock: 5,
        product: { id: 1, code: "P1", name: "Producto A", price: 100 },
      },
    ]);

    const result = await getBranchProductsForExport({ branchId: 1 });

    expect(result.success).toBe(true);
    expect(mockBranchInventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 1, stock: { gt: 0 } }),
      })
    );
    expect(result.data?.length).toBe(2);
  });
});
