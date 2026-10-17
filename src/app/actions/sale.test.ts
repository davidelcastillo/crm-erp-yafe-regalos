/**
 * Integration test for registerSale Server Action - Stock validation
 */
import { registerSale, getSales } from "../actions/sale";
import { PaymentMethod } from "@/lib/utils/payment";

// Mock prisma
const mockProductFindUnique = jest.fn();
const mockBranchFindFirst = jest.fn();
const mockSaleCreate = jest.fn();
const mockSaleItemCreateMany = jest.fn();
const mockProductUpdate = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockSaleFindMany = jest.fn();
const mockSaleCount = jest.fn();
const mockBranchInventoryUpdateMany = jest.fn();
const mockCustomerUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findFirst: (...args: unknown[]) => mockBranchFindFirst(...args),
    },
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
        branchInventory: {
          updateMany: (...args: unknown[]) => mockBranchInventoryUpdateMany(...args),
        },
        customer: {
          update: (...args: unknown[]) => mockCustomerUpdate(...args),
        },
      };
      return callback(tx);
    }),
    sale: {
      findMany: (...args: unknown[]) => mockSaleFindMany(...args),
      count: (...args: unknown[]) => mockSaleCount(...args),
    },
    // Cierres de caja: `getSales` marca las ventas de la caja anterior (S17).
    cashClose: {
      findMany: jest.fn(async () => []),
    },
  },
}));

describe("registerSale Server Action - Stock Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject sale when product has insufficient stock", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique.mockResolvedValue({ id: 1, name: "Producto test" });
    mockSaleCreate.mockResolvedValue({ id: 1, date: new Date(), totalAmount: 150, createdAt: new Date(), updatedAt: new Date() });
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 0 });

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 100, quantity: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(mockSaleCreate).not.toHaveBeenCalled();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  it("should reject sale when product not found", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique.mockResolvedValue(null);

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 999, price: 100, quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrado");
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("should reject sale when one of multiple products has insufficient stock", async () => {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique
      .mockResolvedValueOnce({ id: 1, name: "Producto A" })
      .mockResolvedValueOnce({ id: 2, name: "Producto B" })
      // extra lookup for the failing product name inside the transaction
      .mockResolvedValueOnce({ id: 2, name: "Producto B" });
    mockSaleCreate.mockResolvedValue({ id: 1, date: new Date(), totalAmount: 150, createdAt: new Date(), updatedAt: new Date() });
    mockBranchInventoryUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await registerSale({
      branchId: 1,
      items: [
        { productId: 1, price: 50, quantity: 5 },
        { productId: 2, price: 30, quantity: 10 },
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

    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique
      .mockResolvedValueOnce({ id: 1, name: "Producto A" })
      .mockResolvedValueOnce({ id: 2, name: "Producto B" });

    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mockSaleCreate.mockResolvedValue(mockSale);
    mockSaleItemCreateMany.mockResolvedValue({ count: 2 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue(mockItems);

    const result = await registerSale({
      branchId: 1,
      items: [
        { productId: 1, price: 50, quantity: 2 },
        { productId: 2, price: 25, quantity: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalAmount).toBe(150);
    expect(mockProductUpdate).toHaveBeenCalledTimes(0);
  });
});

describe("getSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return sales with items and total", async () => {
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
    mockSaleCount.mockResolvedValue(1);

    const result = await getSales();

    expect(result.success).toBe(true);
    expect(result.data?.items?.[0]?.date).toBe("2026-04-16T17:19:02.275Z");
    expect(result.data?.items?.[0]?.totalAmount).toBe(150);
    expect(result.data?.total).toBe(1);
    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 })
    );
  });

  it("should filter by product name or code (case-insensitive) when search is provided", async () => {
    mockSaleFindMany.mockResolvedValue([]);
    mockSaleCount.mockResolvedValue(0);

    await getSales({ search: "perno" });

    const searchWhere = {
      items: {
        some: {
          OR: [
            { product: { name: { contains: "perno", mode: "insensitive" } } },
            { product: { code: { contains: "perno", mode: "insensitive" } } },
          ],
        },
      },
    };

    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(searchWhere) })
    );
    expect(mockSaleCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(searchWhere) })
    );
  });

  it("should paginate results with take and skip and return total from count", async () => {
    const mockPage = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      date: new Date(),
      totalAmount: 10,
    }));
    mockSaleFindMany.mockResolvedValue(mockPage);
    mockSaleCount.mockResolvedValue(25);

    const result = await getSales({ take: 10, skip: 0 });

    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(10);
    expect(result.data?.total).toBe(25);
    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 })
    );
    expect(mockSaleCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("should combine search with branch and date filters", async () => {
    mockSaleFindMany.mockResolvedValue([]);
    mockSaleCount.mockResolvedValue(0);

    await getSales({
      branchId: 2,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      search: "tuerca",
    });

    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 2,
          date: {
            gte: new Date("2026-01-01"),
            lte: new Date("2026-12-31"),
          },
          items: {
            some: {
              OR: [
                { product: { name: { contains: "tuerca", mode: "insensitive" } } },
                { product: { code: { contains: "tuerca", mode: "insensitive" } } },
              ],
            },
          },
        },
      })
    );
  });
});

describe("registerSale Server Action - Payment Method Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupSuccessfulSale() {
    mockBranchFindFirst.mockResolvedValue({ id: 1 });
    mockProductFindUnique.mockResolvedValue({ id: 1, name: "Producto Test" });
    mockBranchInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mockSaleCreate.mockResolvedValue({ id: 1, date: new Date(), totalAmount: 500, createdAt: new Date(), updatedAt: new Date() });
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue([{ id: 1, saleId: 1, productId: 1, price: 500, quantity: 1, subtotal: 500, product: { id: 1, name: "Producto Test" } }]);
  }

  it("should set amountPaid = total and pendingBalance = 0 for EFECTIVO", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.EFECTIVO,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.EFECTIVO,
          amountPaid: 500,
          pendingBalance: 0,
        }),
      })
    );
  });

  // Bug 8.3 del usuario: una transferencia es plata cobrada, no deuda.
  it("should set amountPaid = total and pendingBalance = 0 for TRANSFERENCIA", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.TRANSFERENCIA,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.TRANSFERENCIA,
          amountPaid: 500,
          pendingBalance: 0,
        }),
      })
    );
  });

  it("should sum cashAmount + transferAmount for MIXTO", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.MIXTO,
      cashAmount: 200,
      transferAmount: 300,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.MIXTO,
          amountPaid: 500,
          pendingBalance: 0,
        }),
      })
    );
  });

  it("should handle partial MIXTO payment (cash only)", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.MIXTO,
      cashAmount: 100,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.MIXTO,
          amountPaid: 100,
          pendingBalance: 400,
        }),
      })
    );
  });

  it("should reject MIXTO with zero cash and transfer", async () => {
    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.MIXTO,
      cashAmount: 0,
      transferAmount: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("MIXTO requiere cashAmount o transferAmount mayor a 0");
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("should use legacy amountPaid when paymentMethod not provided (backward compat)", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
      amountPaid: 300,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.EFECTIVO,
          amountPaid: 300,
          pendingBalance: 200,
        }),
      })
    );
  });

  it("should use legacy amountPaid=0 when paymentMethod not provided (backward compat)", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      branchId: 1,
      items: [{ productId: 1, price: 500, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.EFECTIVO,
          amountPaid: 0,
          pendingBalance: 500,
        }),
      })
    );
  });
});