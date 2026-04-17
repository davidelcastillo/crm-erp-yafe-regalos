/**
 * Integration test for registerSale - Debt calculation with customer
 * Requirement from septimo_promt.md: Verify that a $1000 sale with $400 paid creates $600 debt
 */
import { registerSale } from "../actions/sale";

// Mock prisma
const mockProductFindUnique = jest.fn();
const mockSaleCreate = jest.fn();
const mockSaleItemCreateMany = jest.fn();
const mockProductUpdate = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockCustomerFindUnique = jest.fn();
const mockCustomerUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
    },
    customer: {
      findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args),
      update: (...args: unknown[]) => mockCustomerUpdate(...args),
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
        customer: {
          update: (...args: unknown[]) => mockCustomerUpdate(...args),
        },
      };
      return callback(tx);
    }),
  },
}));

describe("registerSale - Debt Calculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create $600 pending balance when $1000 sale with $400 paid to customer", async () => {
    // Setup: Product with 10 units in stock
    mockProductFindUnique.mockResolvedValue({
      id: 1,
      name: "Producto Test",
      stock: 10,
    });

    // Setup: Customer with $0 balance
    mockCustomerFindUnique.mockResolvedValue({
      id: 1,
      name: "Juan",
      surname: "Pérez",
      totalBalance: 0,
    });

    // Sale created with pendingBalance
    const mockSale = {
      id: 1,
      date: new Date("2026-04-16"),
      totalAmount: 1000,
      amountPaid: 400,
      pendingBalance: 600,
      customerId: 1,
    };
    mockSaleCreate.mockResolvedValue(mockSale);
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue([
      {
        id: 1,
        saleId: 1,
        productId: 1,
        price: 1000,
        quantity: 1,
        subtotal: 1000,
        product: { id: 1, name: "Producto Test" },
      },
    ]);
    mockCustomerUpdate.mockResolvedValue({ totalBalance: 600 });

    // Execute: $1000 sale, paying $400, customer X
    const result = await registerSale({
      items: [{ productId: 1, price: 1000, quantity: 1 }],
      customerId: 1,
      amountPaid: 400,
    });

    // Verify: Sale created successfully
    expect(result.success).toBe(true);

    // Verify: pendingBalance is $600 (1000 - 400)
    // Result.data has { sale, items, totalAmount } structure from transaction
    expect(result.data?.sale?.pendingBalance).toBe(600);

    // Verify: Customer balance was incremented by $600
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        totalBalance: {
          increment: 600,
        },
      },
    });
  });

  it("should not create debt when amountPaid equals total", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: 1,
      name: "Producto Test",
      stock: 10,
    });

    const mockSale = {
      id: 1,
      date: new Date("2026-04-16"),
      totalAmount: 1000,
      amountPaid: 1000,
      pendingBalance: 0,
    };
    mockSaleCreate.mockResolvedValue(mockSale);
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue([
      {
        id: 1,
        saleId: 1,
        productId: 1,
        price: 1000,
        quantity: 1,
        subtotal: 1000,
        product: { id: 1, name: "Producto Test" },
      },
    ]);

    const result = await registerSale({
      items: [{ productId: 1, price: 1000, quantity: 1 }],
      customerId: 1,
      amountPaid: 1000, // Full payment
    });

    expect(result.success).toBe(true);
    // Result has { sale, items, totalAmount }
    expect(result.data?.sale?.pendingBalance).toBe(0);
    
    // Customer balance should NOT be incremented
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  it("should work without customer (anonymous sale)", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: 1,
      name: "Producto Test",
      stock: 10,
    });

    const mockSale = {
      id: 1,
      date: new Date("2026-04-16"),
      totalAmount: 500,
      amountPaid: 500,
      pendingBalance: 0,
      customerId: null,
    };
    mockSaleCreate.mockResolvedValue(mockSale);
    mockSaleItemCreateMany.mockResolvedValue({ count: 1 });
    mockProductUpdate.mockResolvedValue({});
    mockSaleItemFindMany.mockResolvedValue([
      {
        id: 1,
        saleId: 1,
        productId: 1,
        price: 500,
        quantity: 1,
        subtotal: 500,
        product: { id: 1, name: "Producto Test" },
      },
    ]);

    const result = await registerSale({
      items: [{ productId: 1, price: 500, quantity: 1 }],
      // No customerId = anonymous sale
      amountPaid: 500,
    });

    expect(result.success).toBe(true);
    // Result has { sale, items, totalAmount }
    expect(result.data?.sale?.customerId).toBeNull();
    expect(result.data?.sale?.pendingBalance).toBe(0);
  });
});