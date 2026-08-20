import { sumStock } from "./inventory-stock";

describe("sumStock", () => {
  it("sums stock across all inventory rows", () => {
    expect(
      sumStock({
        inventory: [
          { stock: 10 },
          { stock: 5 },
          { stock: 0 },
        ],
      })
    ).toBe(15);
  });

  it("returns 0 when there are no inventory rows", () => {
    expect(sumStock({ inventory: [] })).toBe(0);
  });

  it("returns 0 when inventory is missing", () => {
    expect(sumStock({})).toBe(0);
  });
});
