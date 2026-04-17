/**
 * Integration test for registerSale Server Action - Stock validation
 */
import { registerSale, getSales } from "../actions/sale";

// Mock prisma
const mockProductFindUnique = jest.fn();
const mockSaleCreate = jest.fn();
const mockSaleItemCreateMany = jest.fn();
const mockProductUpdate = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockSaleFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
    },
    $transaction: jest.fn((callback) => {
      const tx = {
        sale: {
          create: (...args: unknown[]) => mockSaleCreate(...args),
        },
        saleItem: {
          createMany: (...args: unknown[]) => mockSaleItemCreateMany(...args),
          findMany: (...args: unknown[]) => mockSaleItemFindMany(...args),
        },
        product: {
          update: (...args: unknown[]) => mockProductUpdate(...args),
        },
      };
      return callback(tx);
    }),
    sale: {
      findMany: (...args: unknown[]) => mockSaleFindMany(...args),
    },
  },
}));

describe("registerSale Server Action - Stock Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject sale when product has insufficient stock", async () => {
    // Product with only 5 units in stock
    mockProductFindUnique.mockResolvedValue({
      id: 1,
      name: "Producto test",
      stock: 5, // Only 5 available
    });

    const result = await registerSale({
      items: [
        { productId: 1, price: 100, quantity: 10 }, // Requesting 10 but only 5 available
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(result.error).toContain("Disponible: 5");
    expect(result.error).toContain("Solicitado: 10");
    
    // Verify no transaction was started
    expect(mockSaleCreate).not.toHaveBeenCalled();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  it("should reject sale when product not found", async () => {
    mockProductFindUnique.mockResolvedValue(null);

    const result = await registerSale({
      items: [
        { productId: 999, price: 100, quantity: 1 },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrado");
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("should reject sale when one of multiple products has insufficient stock", async () => {
    mockProductFindUnique
      .mockResolvedValueOnce({
        id: 1,
        name: "Producto A",
        stock: 10, // Enough
      })
      .mockResolvedValueOnce({
        id: 2,
        name: "Producto B",
        stock: 2, // Not enough
      });

    const result = await registerSale({
      items: [
        { productId: 1, price: 50, quantity: 5 },
        { productId: 2, price: 30, quantity: 10 }, // 10 requested but only 2 available
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(result.error).toContain("Producto B");
  });

  it("should successfully create sale when all products have sufficient stock", async () => {
    const mockSale = { id: 1, date: new Date(), totalAmount: 150, createdAt: new Date(), updatedAt: new Date() };
    const mockItems = [
      { id: 1, saleId: 1, productId: 1, price: 50, quantity: 2, subtotal: 100, product: { id: 1, name: "Producto A" } },
      { id: 2, saleId: 1, productId: 2, price: 25, quantity: 2, subtotal: 50, product: { id: 2, name: "Producto B" } },
    ];

    mockProductFindUnique
      .mockResolvedValueOnce({ id: 1, name: "Producto A", stock: 10 })
      .mockResolvedValueOnce({ id: 2, name: "Producto B", stock: 5 });

    mockSaleCreate.mockResolvedValue(mockSale);
    mockSaleItemCreateMany.mockResolvedValue({ count: 2 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue(mockItems);

    const result = await registerSale({
      items: [
        { productId: 1, price: 50, quantity: 2 },
        { productId: 2, price: 25, quantity: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalAmount).toBe(150);
    
    // Verify stock was decremented
    expect(mockProductUpdate).toHaveBeenCalledTimes(2);
  });
});

describe("getSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return sales with items", async () => {
    // Mock returns raw Prisma data (with Date objects)
    const mockSalesFromDb = [
      {
        id: 1,
        date: new Date("2026-04-16T17:19:02.275Z"),
        totalAmount: 150,
        items: [
          { id: 1, productId: 1, price: 50, quantity: 2, subtotal: 100, product: { id: 1, name: "Product A" } },
        ],
      },
    ];

    mockSaleFindMany.mockResolvedValue(mockSalesFromDb);

    const result = await getSales();

    expect(result.success).toBe(true);
    // getSales uses parseArray which converts Date to string
    expect(result.data?.[0]?.date).toBe("2026-04-16T17:19:02.275Z");
    expect(result.data?.[0]?.totalAmount).toBe(150);
  });
});