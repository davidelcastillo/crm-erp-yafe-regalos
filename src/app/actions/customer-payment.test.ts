/**
 * Test for registerPayment - String to number coercion
 */
import { registerPayment } from "../actions/customer";

// Mock prisma
const mockCustomerFindUnique = jest.fn();
const mockPaymentCreate = jest.fn();
const mockCustomerUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args),
      update: (...args: unknown[]) => mockCustomerUpdate(...args),
    },
    $transaction: jest.fn((callback) => {
      const tx = {
        payment: {
          create: (...args: unknown[]) => mockPaymentCreate(...args),
        },
        customer: {
          update: (...args: unknown[]) => mockCustomerUpdate(...args),
        },
      };
      return callback(tx);
    }),
  },
}));

describe("registerPayment - String Coercion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should accept number amount", async () => {
    mockCustomerFindUnique.mockResolvedValue({
      id: 1,
      name: "Juan",
      surname: "Pérez",
      totalBalance: 1000,
    });
    mockPaymentCreate.mockResolvedValue({ id: 1, customerId: 1, amount: 500, date: new Date() });
    mockCustomerUpdate.mockResolvedValue({ totalBalance: 500 });

    const result = await registerPayment({
      customerId: 1,
      amount: 500, // number
    });

    expect(result.success).toBe(true);
  });

  it("should accept string amount (from form input)", async () => {
    mockCustomerFindUnique.mockResolvedValue({
      id: 1,
      name: "Juan",
      surname: "Pérez",
      totalBalance: 3000,
    });
    mockPaymentCreate.mockResolvedValue({ id: 1, customerId: 1, amount: 2500, date: new Date() });
    mockCustomerUpdate.mockResolvedValue({ totalBalance: 500 });

    // This is what comes from SweetAlert2 form input - a string!
    const result = await registerPayment({
      customerId: 1,
      amount: "2500", // string from form
    });

    expect(result.success).toBe(true);
    expect(mockPaymentCreate).toHaveBeenCalled();
  });

  it("should reject invalid amount", async () => {
    mockCustomerFindUnique.mockResolvedValue({
      id: 1,
      name: "Juan",
      surname: "Pérez",
      totalBalance: 100,
    });

    const result = await registerPayment({
      customerId: 1,
      amount: "invalid", // not a number
    });

    expect(result.success).toBe(false);
  });
});