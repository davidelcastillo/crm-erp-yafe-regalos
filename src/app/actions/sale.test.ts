/**
 * Integration test for registerSale Server Action - Stock validation
 */
import { registerSale, getSales } from "../actions/sale";
import { PaymentMethod } from "@/lib/utils/payment";

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
    mockProductFindUnique.mockResolvedValue({
      id: 1,
      name: "Producto test",
      stock: 5,
    });

    const result = await registerSale({
      items: [{ productId: 1, price: 100, quantity: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Stock insuficiente");
    expect(result.error).toContain("Disponible: 5");
    expect(result.error).toContain("Solicitado: 10");
    expect(mockSaleCreate).not.toHaveBeenCalled();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  it("should reject sale when product not found", async () => {
    mockProductFindUnique.mockResolvedValue(null);

    const result = await registerSale({
      items: [{ productId: 999, price: 100, quantity: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrado");
    expect(mockSaleCreate).not.toHaveBeenCalled();
  });

  it("should reject sale when one of multiple products has insufficient stock", async () => {
    mockProductFindUnique
      .mockResolvedValueOnce({ id: 1, name: "Producto A", stock: 10 })
      .mockResolvedValueOnce({ id: 2, name: "Producto B", stock: 2 });

    const result = await registerSale({
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
    expect(mockProductUpdate).toHaveBeenCalledTimes(2);
  });
});

describe("getSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return sales with items", async () => {
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
    expect(result.data?.[0]?.date).toBe("2026-04-16T17:19:02.275Z");
    expect(result.data?.[0]?.totalAmount).toBe(150);
  });
});

describe("registerSale Server Action - Payment Method Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupSuccessfulSale() {
    mockProductFindUnique.mockResolvedValue({ id: 1, name: "Producto Test", stock: 10 });
    mockSaleCreate.mockResolvedValue({ id: 1, date: new Date(), totalAmount: 500, createdAt: new Date(), updatedAt: new Date() });
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue([{ id: 1, saleId: 1, productId: 1, price: 500, quantity: 1, subtotal: 500, product: { id: 1, name: "Producto Test" } }]);
  }

  it("should set amountPaid = total and pendingBalance = 0 for EFECTIVO", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
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

  it("should set amountPaid = 0 and pendingBalance = total for TRANSFERENCIA", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
      items: [{ productId: 1, price: 500, quantity: 1 }],
      paymentMethod: PaymentMethod.TRANSFERENCIA,
    });

    expect(result.success).toBe(true);
    expect(mockSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.TRANSFERENCIA,
          amountPaid: 0,
          pendingBalance: 500,
        }),
      })
    );
  });

  it("should sum cashAmount + transferAmount for MIXTO", async () => {
    setupSuccessfulSale();

    const result = await registerSale({
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
    mockProductFindUnique.mockResolvedValue({ id: 1, name: "Producto Test", stock: 10 });

    const result = await registerSale({
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