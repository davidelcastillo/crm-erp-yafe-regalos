/**
 * Tests for getStats Server Action — dashboard period, date range and branch scoping.
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fase4-ui-portal-export/specs/dashboard-customization/spec.md
 */
import { getStats } from "./dashboard";

const mockSaleAggregate = jest.fn();
const mockPurchaseAggregate = jest.fn();
const mockCustomerAggregate = jest.fn();
const mockCashGroupBy = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    sale: {
      aggregate: (...args: unknown[]) => mockSaleAggregate(...args),
    },
    purchase: {
      aggregate: (...args: unknown[]) => mockPurchaseAggregate(...args),
    },
    customer: {
      aggregate: (...args: unknown[]) => mockCustomerAggregate(...args),
    },
    // Plata de caja: entra en el balance (S18).
    cashMovement: {
      groupBy: (...args: unknown[]) => mockCashGroupBy(...args),
    },
  },
}));

function mockEmptyAggregates() {
  mockSaleAggregate.mockResolvedValue({
    _sum: { totalAmount: 0, pendingBalance: 0 },
  });
  mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });
  mockCustomerAggregate.mockResolvedValue({ _sum: { totalBalance: 0 } });
  mockCashGroupBy.mockResolvedValue([]);
}

describe("getStats (dashboard period + range + branch)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmptyAggregates();
  });

  it("rejects a custom range with a missing endDate", async () => {
    const result = await getStats({ type: "custom", startDate: "2026-01-01" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Seleccioná un rango de fechas");
    }
    expect(mockSaleAggregate).not.toHaveBeenCalled();
  });

  it("rejects a custom range where startDate is after endDate", async () => {
    const result = await getStats({
      type: "custom",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Rango de fechas inválido");
    }
    expect(mockSaleAggregate).not.toHaveBeenCalled();
  });

  it("accepts type '7' without explicit dates and filters the last 7 days", async () => {
    const result = await getStats({ type: "7" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(
        expect.objectContaining({
          totalIncome: 0,
          totalExpense: 0,
          netProfit: 0,
          accountsReceivable: 0,
        })
      );
    }

    const where = mockSaleAggregate.mock.calls[0][0].where;
    // Días calendario locales: 7 días contando hoy (del inicio de hoy-6 al final de
    // hoy), que es el mismo rango que usa el gráfico. Antes era `now - 7 días`.
    const expectedStart = new Date();
    expectedStart.setDate(expectedStart.getDate() - 6);
    expectedStart.setHours(0, 0, 0, 0);
    const expectedEnd = new Date();
    expectedEnd.setHours(23, 59, 59, 999);

    expect(where.date.gte).toBeInstanceOf(Date);
    expect(where.date.lte).toBeInstanceOf(Date);
    expect(where.date.gte.getTime()).toBe(expectedStart.getTime());
    expect(where.date.lte.getTime()).toBe(expectedEnd.getTime());
  });

  it("omits branchId from the query when no branch is provided (global)", async () => {
    await getStats({ type: "30" });

    const where = mockSaleAggregate.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("branchId");
    expect(where.date).toBeDefined();
  });

  it("includes branchId in the query when a branch is provided (branch-scoped)", async () => {
    await getStats({ type: "30", branchId: 1 });

    const where = mockSaleAggregate.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({ branchId: 1 }));
    expect(where.date).toBeDefined();
  });
});
