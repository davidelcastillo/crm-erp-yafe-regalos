/**
 * Integration test for registerPurchase Server Action (multiple products)
 */
import { registerPurchase, getPurchases, getPurchaseById } from "../actions/purchase";

// Mock prisma
const mockBranchFindFirst = jest.fn();
const mockPurchaseCreate = jest.fn();
const mockPurchaseItemCreateMany = jest.fn();
const mockBranchInventoryUpsert = jest.fn();
const mockPurchaseItemFindMany = jest.fn();
const mockPurchaseFindMany = jest.fn();
const mockPurchaseFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findFirst: (...args: unknown[]) => mockBranchFindFirst(...args),
    },
    $transaction: jest.fn((callback) => {
      const tx = {
        purchase: {
          create: (...args: unknown[]) => mockPurchaseCreate(...args),
        },
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
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
      findUnique: (...args: unknown[]) => mockPurchaseFindUnique(...args),
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

    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockPurchaseCreate.mockResolvedValue(mockPurchase);
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 2 });
    mockBranchInventoryUpsert.mockResolvedValue({});
    mockPurchaseItemFindMany.mockResolvedValue(mockItems);

    const result = await registerPurchase({
      branchId: 1,
      items: [
        { productId: 5, price: 50, quantity: 2 },
        { productId: 3, price: 25.50, quantity: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalAmount).toBe(151); // 100 + 51 = 151
    
    expect(mockPurchaseCreate).toHaveBeenCalledWith({
      data: { totalAmount: 151, branchId: 1 },
    });
    
    expect(mockPurchaseItemCreateMany).toHaveBeenCalledWith({
      data: [
        { purchaseId: 1, productId: 5, price: 50, quantity: 2, subtotal: 100 },
        { purchaseId: 1, productId: 3, price: 25.50, quantity: 2, subtotal: 51 },
      ],
    });
    
    // Stock increments target BranchInventory (once per item), not Product
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(2);
  });

  it("should accept string values from form with coerce", async () => {
    const mockPurchase = { id: 1, date: new Date(), totalAmount: 100, createdAt: new Date(), updatedAt: new Date() };
    const mockItems = [
      { id: 1, purchaseId: 1, productId: 1, price: 100, quantity: 5, subtotal: 500, product: { id: 1, name: "Product" } },
    ];

    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockPurchaseCreate.mockResolvedValue(mockPurchase);
    mockPurchaseItemCreateMany.mockResolvedValue({ count: 1 });
    mockBranchInventoryUpsert.mockResolvedValue({});
    mockPurchaseItemFindMany.mockResolvedValue(mockItems);

    // Strings from form
    const result = await registerPurchase({
      branchId: 1,
      items: [
        { productId: "1", price: "100", quantity: "5" },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(1);
  });

  it("should return error when no items provided", async () => {
    const result = await registerPurchase({ items: [] });
    expect(result.success).toBe(false);
  });

  it("should handle database errors", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockPurchaseCreate.mockRejectedValue(new Error("Database error"));

    const result = await registerPurchase({
      branchId: 1,
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

  it("sin filtro de sucursal devuelve también las compras sin sucursal", async () => {
    mockPurchaseFindMany.mockResolvedValue([
      {
        id: 9,
        date: new Date("2026-04-16T17:19:51.968Z"),
        totalAmount: 120,
        branchId: null,
        branch: null,
        items: [],
      },
    ]);

    const result = await getPurchases();

    expect(result.success).toBe(true);
    // Sin filtro no se ocultan: el where no lleva branchId.
    expect(mockPurchaseFindMany.mock.calls[0][0].where).toEqual({});
    const compra = result.data?.[0] as { branch: unknown; branchId: unknown } | undefined;
    expect(compra?.branch).toBeNull();
    expect(compra?.branchId).toBeNull();
  });

  it("con filtro de sucursal siguen filtrándose por branchId", async () => {
    mockPurchaseFindMany.mockResolvedValue([]);

    await getPurchases({ branchId: 3 });

    expect(mockPurchaseFindMany.mock.calls[0][0].where).toEqual({ branchId: 3 });
  });

  it("getPurchaseById tolera una compra sin sucursal", async () => {
    mockPurchaseFindUnique.mockResolvedValue({
      id: 9,
      date: new Date("2026-04-16T17:19:51.968Z"),
      totalAmount: 120,
      branchId: null,
      items: [],
    });

    const result = await getPurchaseById(9);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { branchId: unknown }).branchId).toBeNull();
  });
});
// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe("compras: autorización admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rechaza registerPurchase sin sesión admin y no toca Prisma", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      "@/lib/auth-guard"
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    // Sucursal inválida: si el guardián no fuera primero, el error sería de Zod.
    const result = await registerPurchase({
      items: [{ productId: 1, price: 10, quantity: 1 }],
      branchId: -1,
    });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(mockBranchFindFirst).not.toHaveBeenCalled();
  });
});
