// src/lib/validations/__tests__/validations.test.ts
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from "@/lib/validations/category";
import { moveStockSchema, assignStockSchema } from "@/lib/validations/branchMovement";
import {
  purchaseSplitItemSchema,
  createPurchaseWithBranchSplitSchema,
} from "@/lib/validations/purchase";
import { updateProductExtendedSchema } from "@/lib/validations/product";

describe("Phase 4 validations — Fase 3", () => {
  describe("createCategorySchema", () => {
    it("accepts a valid name", () => {
      expect(createCategorySchema.parse({ name: "General" })).toEqual({ name: "General" });
    });
    it("rejects empty name", () => {
      expect(() => createCategorySchema.parse({ name: "" })).toThrow();
    });
    it("rejects name longer than 100 chars", () => {
      expect(() => createCategorySchema.parse({ name: "x".repeat(101) })).toThrow();
    });
  });

  describe("updateCategorySchema", () => {
    it("accepts id and name", () => {
      expect(updateCategorySchema.parse({ id: 1, name: "Nuevo" })).toEqual({
        id: 1,
        name: "Nuevo",
      });
    });
    it("rejects invalid id", () => {
      expect(() => updateCategorySchema.parse({ id: -1, name: "x" })).toThrow();
    });
  });

  describe("deleteCategorySchema", () => {
    it("accepts valid id", () => {
      expect(deleteCategorySchema.parse({ id: 5 })).toEqual({ id: 5 });
    });
    it("rejects invalid id", () => {
      expect(() => deleteCategorySchema.parse({ id: 0 })).toThrow();
    });
  });

  describe("moveStockSchema", () => {
    const valid = {
      productId: 1,
      sourceBranchId: 1,
      destBranchId: 2,
      quantity: 5,
      performedBy: "admin",
    };

    it("accepts valid move", () => {
      expect(moveStockSchema.parse(valid)).toEqual(valid);
    });
    it("rejects origen == destino (refine)", () => {
      const r = moveStockSchema.safeParse({ ...valid, destBranchId: 1 });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toContain("distintas");
      }
    });
    it("rejects quantity <= 0", () => {
      const r = moveStockSchema.safeParse({ ...valid, quantity: 0 });
      expect(r.success).toBe(false);
    });
  });

  describe("assignStockSchema", () => {
    it("accepts valid assign with optional performedBy", () => {
      expect(assignStockSchema.parse({ productId: 1, branchId: 2, quantity: 10 })).toEqual({
        productId: 1,
        branchId: 2,
        quantity: 10,
      });
    });
    it("accepts negative quantity (remover stock)", () => {
      const r = assignStockSchema.safeParse({ productId: 1, branchId: 2, quantity: -3 });
      expect(r.success).toBe(true);
    });
    it("rejects non-integer quantity", () => {
      const r = assignStockSchema.safeParse({ productId: 1, branchId: 2, quantity: 1.5 });
      expect(r.success).toBe(false);
    });
  });

  describe("purchaseSplitItemSchema & createPurchaseWithBranchSplitSchema", () => {
    const item = { productId: 1, branchId: 2, quantity: 5, price: 10.5 };
    it("accepts valid item", () => {
      expect(purchaseSplitItemSchema.parse(item)).toEqual(item);
    });
    it("rejects price <= 0", () => {
      expect(() => purchaseSplitItemSchema.parse({ ...item, price: 0 })).toThrow();
    });
    it("accepts items array with >= 1 line", () => {
      expect(createPurchaseWithBranchSplitSchema.parse({ items: [item] })).toEqual({
        items: [item],
      });
    });
    it("rejects empty items array", () => {
      const r = createPurchaseWithBranchSplitSchema.safeParse({ items: [] });
      expect(r.success).toBe(false);
    });
  });

  describe("updateProductExtendedSchema", () => {
    it("accepts all new fields", () => {
      const r = updateProductExtendedSchema.safeParse({
        id: 1,
        name: "Nuevo",
        categoryId: 2,
        active: false,
      });
      expect(r.success).toBe(true);
    });
    it("accepts categoryId null (descategorizar)", () => {
      const r = updateProductExtendedSchema.safeParse({ id: 1, categoryId: null });
      expect(r.success).toBe(true);
    });
    it("rejects invalid id", () => {
      const r = updateProductExtendedSchema.safeParse({ id: -1 });
      expect(r.success).toBe(false);
    });
  });
});
