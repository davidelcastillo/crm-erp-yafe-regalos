/**
 * Unit tests for the inventory export validation schema (exportInventorySchema)
 */

import { exportInventorySchema } from "@/lib/validations/export";

describe("exportInventorySchema", () => {
  it("accepts a valid input with branchId and selected product ids", () => {
    const parsed = exportInventorySchema.parse({
      branchId: 1,
      selectedProductIds: [1, 2, 3],
    });
    expect(parsed.branchId).toBe(1);
    expect(parsed.selectedProductIds).toEqual([1, 2, 3]);
  });

  it("rejects branchId 0, negative, or non-integer", () => {
    expect(
      exportInventorySchema.safeParse({ branchId: 0, selectedProductIds: [1] })
        .success
    ).toBe(false);
    expect(
      exportInventorySchema.safeParse({ branchId: -1, selectedProductIds: [1] })
        .success
    ).toBe(false);
    expect(
      exportInventorySchema.safeParse({ branchId: 1.5, selectedProductIds: [1] })
        .success
    ).toBe(false);
  });

  it("rejects an empty selectedProductIds array", () => {
    const result = exportInventorySchema.safeParse({
      branchId: 1,
      selectedProductIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive product id", () => {
    const result = exportInventorySchema.safeParse({
      branchId: 1,
      selectedProductIds: [0],
    });
    expect(result.success).toBe(false);
  });
});
