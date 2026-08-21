/**
 * Unit/Integration tests for Product soft-delete / extended update (Fase 3)
 *
 * Covers:
 *   - toggleProductActive (soft-delete vía `active`)
 *   - getActiveProducts / getInactiveProducts
 *   - reactivateProduct
 *   - updateProductExtended (categoryId nullable + active toggle)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fase3-inventory-branch-interfaces/specs/product-soft-delete/spec.md
 */

import {
  toggleProductActive,
  getActiveProducts,
  getInactiveProducts,
  reactivateProduct,
  updateProductExtended,
} from "@/app/actions/product";

const mockProductFindMany = jest.fn();
const mockProductFindUnique = jest.fn();
const mockProductUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
    },
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("toggleProductActive (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deactivates a product setting active=false (soft-delete)", async () => {
    mockProductUpdate.mockResolvedValue({ id: 1, active: false });

    const result = await toggleProductActive({ id: 1, active: false });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { active: false },
      })
    );
  });

  it("reactivates a product setting active=true", async () => {
    mockProductUpdate.mockResolvedValue({ id: 1, active: true });

    const result = await toggleProductActive({ id: 1, active: true });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { active: true },
      })
    );
  });

  it("rejects invalid id (Zod)", async () => {
    const result = await toggleProductActive({ id: 0, active: false });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });

  it("rejects missing active boolean (Zod)", async () => {
    const result = await toggleProductActive({ id: 1 } as never);
    expect(result.success).toBe(false);
  });
});

describe("getActiveProducts / getInactiveProducts (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getActiveProducts filters active=true", async () => {
    mockProductFindMany.mockResolvedValue([{ id: 1, name: "A", active: true }]);

    const result = await getActiveProducts();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
  });

  it("getInactiveProducts filters active=false and includes category", async () => {
    mockProductFindMany.mockResolvedValue([
      {
        id: 2,
        name: "B",
        active: false,
        category: { id: 1, name: "General" },
      },
    ]);

    const result = await getInactiveProducts();

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.category?.name).toBe("General");
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: false },
        include: { category: { select: { id: true, name: true } } },
      })
    );
  });
});

describe("reactivateProduct (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets active=true on the product", async () => {
    mockProductUpdate.mockResolvedValue({ id: 5, active: true });

    const result = await reactivateProduct({ id: 5 });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { active: true },
      })
    );
  });

  it("rejects invalid id (Zod)", async () => {
    const result = await reactivateProduct({ id: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });
});

describe("updateProductExtended (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates name, price, categoryId, and active together", async () => {
    mockProductUpdate.mockResolvedValue({
      id: 1,
      name: "Nuevo",
      price: 12,
      categoryId: 2,
      active: false,
    });

    const result = await updateProductExtended({
      id: 1,
      name: "Nuevo",
      price: 12,
      categoryId: 2,
      active: false,
    });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Nuevo",
          price: 12,
          categoryId: 2,
          active: false,
        }),
      })
    );
  });

  it("accepts categoryId=null to descategorizar", async () => {
    mockProductUpdate.mockResolvedValue({ id: 1, categoryId: null });

    const result = await updateProductExtended({ id: 1, categoryId: null });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: null }) })
    );
  });

  it("rejects invalid id (Zod)", async () => {
    const result = await updateProductExtended({ id: 0, name: "x" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });

  it("returns friendly error on P2003 FK constraint (categoryId no existe)", async () => {
    mockProductUpdate.mockRejectedValue({ code: "P2003" });

    const result = await updateProductExtended({ id: 1, categoryId: 999 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("categoría seleccionada no existe");
  });
});
