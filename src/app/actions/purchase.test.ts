/**
 * Integration test for registerPurchase Server Action (multiple products)
 */
import { registerPurchase, getPurchases } from "../actions/purchase";

// Mock prisma
const mockPurchaseCreate = jest.fn();
const mockPurchaseItemCreateMany = jest.fn();
const mockProductUpdate = jest.fn();
const mockPurchaseItemFindMany = jest.fn();
const mockPurchaseFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn((callback) => {
      const tx = {
        purchase: {
          create: (...args: unknown[]) => mockPurchaseCreate(...args),
        },
        purchaseItem: {
          createMany: (...args: unknown[]) => mockPurchaseItemCreateMany(...args),
          findMany: (...args: unknown[]) => mockPurchaseItemFindMany(...args),
        },
        product: {
          update: (...args: unknown[]) => mockProductUpdate(...args),
        },
      };
      return callback(tx);
    }),
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
    },
  },
}));

describe("registerPurchase Server Action - Multi-product", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a purchase with multiple items and increase stock", async () => {
    const mockPurchase = { id: 1, date: new Date(), totalAmount: 150.50, createdAt: new Date(), updatedAt: new Date() };
    const mockItems = [
      { id: 1, purchaseId: 1, productId: 5, price: 50, quantity: 2, subtotal: 100, product: { id: 5, name: "Product A" } },
      { id: 2, purchaseId: 1, productId: 3, price: 25.50, quantity: 2, subtotal: 51, product: { id: 3, name: "Product B" } },
    ];

    mockPurchaseCreate.mockResolvedValue(mockPurchase);
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 2 });
    mockProductUpdate.mockResolvedValue({});
    mockPurchaseItemFindMany.mockResolvedValue(mockItems);

    const result = await registerPurchase({
      items: [
        { productId: 5, price: 50, quantity: 2 },
        { productId: 3, price: 25.50, quantity: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalAmount).toBe(151); // 100 + 51 = 151
    
    expect(mockPurchaseCreate).toHaveBeenCalledWith({
      data: { totalAmount: 151 },
    });
    
    expect(mockPurchaseItemCreateMany).toHaveBeenCalledWith({
      data: [
        { purchaseId: 1, productId: 5, price: 50, quantity: 2, subtotal: 100 },
        { purchaseId: 1, productId: 3, price: 25.50, quantity: 2, subtotal: 51 },
      ],
    });
    
    expect(mockProductUpdate).toHaveBeenCalledTimes(2);
  });

  it("should accept string values from form with coerce", async () => {
    const mockPurchase = { id: 1, date: new Date(), totalAmount: 100, createdAt: new Date(), updatedAt: new Date() };
    const mockItems = [
      { id: 1, purchaseId: 1, productId: 1, price: 100, quantity: 5, subtotal: 500, product: { id: 1, name: "Product" } },
    ];

    mockPurchaseCreate.mockResolvedValue(mockPurchase);
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockPurchaseItemFindMany.mockResolvedValue(mockItems);

    // Strings from form
    const result = await registerPurchase({
      items: [
        { productId: "1", price: "100", quantity: "5" },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledTimes(1);
  });

  it("should return error when no items provided", async () => {
    const result = await registerPurchase({ items: [] });
    expect(result.success).toBe(false);
  });

  it("should handle database errors", async () => {
    mockPurchaseCreate.mockRejectedValue(new Error("Database error"));

    const result = await registerPurchase({
      items: [{ productId: 1, price: 100, quantity: 5 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al registrar la compra");
  });
});

describe("getPurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return purchases with items", async () => {
    const mockPurchasesFromDb = [
      {
        id: 1,
        date: new Date("2026-04-16T17:19:51.968Z"),
        totalAmount: 150,
        items: [
          { id: 1, productId: 5, price: 50, quantity: 2, subtotal: 100, product: { id: 5, name: "Product A" } },
        ],
      },
    ];

    mockPurchaseFindMany.mockResolvedValue(mockPurchasesFromDb);

    const result = await getPurchases();

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.date).toBe("2026-04-16T17:19:51.968Z");
    expect(result.data?.[0]?.totalAmount).toBe(150);
  });
});