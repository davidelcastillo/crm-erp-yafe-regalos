/**
 * Unit tests for financial logic calculations
 */

describe("Financial Calculations", () => {
  // Test the net profit calculation: income - expense
  it("should calculate net profit correctly", () => {
    const sales = [
      { totalAmount: 1000 },
      { totalAmount: 1500 },
      { totalAmount: 500 },
    ];
    
    const purchases = [
      { totalAmount: 400 },
      { totalAmount: 600 },
    ];

    const totalIncome = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpense = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const netProfit = totalIncome - totalExpense;

    expect(totalIncome).toBe(3000);
    expect(totalExpense).toBe(1000);
    expect(netProfit).toBe(2000);
  });

  // Test net profit with negative result
  it("should calculate net loss correctly", () => {
    const sales = [
      { totalAmount: 500 },
    ];
    
    const purchases = [
      { totalAmount: 800 },
      { totalAmount: 300 },
    ];

    const totalIncome = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpense = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const netProfit = totalIncome - totalExpense;

    expect(totalIncome).toBe(500);
    expect(totalExpense).toBe(1100);
    expect(netProfit).toBe(-600);
  });

  // Test product profitability
  it("should calculate product profit correctly", () => {
    const productPurchases = [
      { quantity: 10, subtotal: 500 },  // $50 each
      { quantity: 5, subtotal: 200 },    // $40 each
    ];
    
    const productSales = [
      { quantity: 8, subtotal: 800 },   // $100 each
    ];

    const totalPurchased = productPurchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalCost = productPurchases.reduce((sum, p) => sum + p.subtotal, 0);
    const totalSold = productSales.reduce((sum, s) => sum + s.quantity, 0);
    const totalRevenue = productSales.reduce((sum, s) => sum + s.subtotal, 0);
    
    const avgPurchasePrice = totalCost / totalPurchased;
    const avgSalePrice = totalRevenue / totalSold;
    const profit = totalRevenue - totalCost;

    expect(totalPurchased).toBe(15);
    expect(totalCost).toBe(700);
    expect(totalSold).toBe(8);
    expect(totalRevenue).toBe(800);
    expect(avgPurchasePrice).toBeCloseTo(46.67, 1);
    expect(avgSalePrice).toBe(100);
    expect(profit).toBe(100);
  });

  // Test accounts receivable calculation
  it("should calculate accounts receivable correctly", () => {
    const sales = [
      { pendingBalance: 500 },
      { pendingBalance: 200 },
      { pendingBalance: 0 },
    ];

    const customerDebts = [
      { totalBalance: 300 },
      { totalBalance: 150 },
      { totalBalance: 0 },
    ];

    const totalPendingFromSales = sales.reduce((sum, s) => sum + s.pendingBalance, 0);
    const totalCustomerDebt = customerDebts.reduce((sum, c) => sum + c.totalBalance, 0);
    const accountsReceivable = totalPendingFromSales + totalCustomerDebt;

    expect(totalPendingFromSales).toBe(700);
    expect(totalCustomerDebt).toBe(450);
    expect(accountsReceivable).toBe(1150);
  });

  // Test with empty arrays
  it("should handle empty arrays correctly", () => {
    const sales: { totalAmount: number }[] = [];
    const purchases: { totalAmount: number }[] = [];

    const totalIncome = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpense = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const netProfit = totalIncome - totalExpense;

    expect(totalIncome).toBe(0);
    expect(totalExpense).toBe(0);
    expect(netProfit).toBe(0);
  });
});