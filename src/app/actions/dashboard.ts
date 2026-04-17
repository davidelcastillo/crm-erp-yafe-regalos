"use server";

import { prisma } from "@/lib/prisma";

export async function getGlobalStats() {
  try {
    // Get all sales
    const sales = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    // Get all purchases
    const purchases = await prisma.purchase.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    // Get all customer debt
    const customers = await prisma.customer.aggregate({
      _sum: {
        totalBalance: true,
      },
    });

    // Or get pending balance from sales
    const pendingSales = await prisma.sale.aggregate({
      _sum: {
        pendingBalance: true,
      },
    });

    // Parse Decimal to number
    const totalIncome = Number(sales._sum.totalAmount || 0);
    const totalExpense = Number(purchases._sum.totalAmount || 0);
    const netProfit = totalIncome - totalExpense;
    const accountsReceivable = Number(customers._sum.totalBalance || 0) + Number(pendingSales._sum.pendingBalance || 0);

    return {
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netProfit,
        accountsReceivable,
      },
    };
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return { success: false, error: "Error al obtener estadísticas" };
  }
}

// Get last N days of sales and purchases for chart
export async function getPerformanceData(days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily sales
    const sales = await prisma.sale.groupBy({
      by: ["date"],
      where: {
        date: {
          gte: startDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Get daily purchases
    const purchases = await prisma.purchase.groupBy({
      by: ["date"],
      where: {
        date: {
          gte: startDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Normalize dates and combine data
    const dailyData: Record<string, { income: number; expense: number }> = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyData[dateStr] = { income: 0, expense: 0 };
    }

    // Fill in sales
    sales.forEach((s) => {
      const dateStr = new Date(s.date).toISOString().split("T")[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].income = Number(s._sum.totalAmount || 0);
      }
    });

    // Fill in purchases
    purchases.forEach((p) => {
      const dateStr = new Date(p.date).toISOString().split("T")[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].expense = Number(p._sum.totalAmount || 0);
      }
    });

    // Convert to array for chart
    const chartData = Object.entries(dailyData)
      .map(([date, values]) => ({
        date,
        ...values,
      }))
      .reverse();

    return {
      success: true,
      data: chartData,
    };
  } catch (error) {
    console.error("Error fetching performance data:", error);
    return { success: false, error: "Error al obtener datos de rendimiento" };
  }
}

// Get analytics for a specific product
export async function getProductAnalytics(productId: number) {
  try {
    // Get purchase data for this product
    const purchases = await prisma.purchaseItem.findMany({
      where: { productId },
      include: {
        purchase: true,
      },
    });

    // Get sale data for this product
    const sales = await prisma.saleItem.findMany({
      where: { productId },
      include: {
        sale: true,
      },
    });

    // Calculate totals
    let totalPurchased = 0;
    let totalPurchaseCost = 0;
    purchases.forEach((p) => {
      totalPurchased += p.quantity;
      totalPurchaseCost += Number(p.subtotal);
    });

    let totalSold = 0;
    let totalSaleRevenue = 0;
    sales.forEach((s) => {
      totalSold += s.quantity;
      totalSaleRevenue += Number(s.subtotal);
    });

    const avgPurchasePrice = totalPurchased > 0 ? totalPurchaseCost / totalPurchased : 0;
    const avgSalePrice = totalSold > 0 ? totalSaleRevenue / totalSold : 0;
    const profit = totalSaleRevenue - totalPurchaseCost;

    return {
      success: true,
      data: {
        productId,
        totalPurchased,
        totalPurchaseCost,
        avgPurchasePrice,
        totalSold,
        totalSaleRevenue,
        avgSalePrice,
        profit,
      },
    };
  } catch (error) {
    console.error("Error fetching product analytics:", error);
    return { success: false, error: "Error al obtener analytics del producto" };
  }
}