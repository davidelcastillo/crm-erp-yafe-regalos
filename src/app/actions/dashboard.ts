"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";

const globalStatsSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

const statsSchema = z.object({
  type: z.enum(["7", "30", "90", "custom"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

async function fetchStats(where: Record<string, unknown> = {}) {
  // Get all sales
  const sales = await prisma.sale.aggregate({
    _sum: { totalAmount: true },
    where,
  });

  // Get all purchases
  const purchases = await prisma.purchase.aggregate({
    _sum: { totalAmount: true },
    where,
  });

  // Get all customer debt (global - not branch-scoped, customer debt is per customer not per branch)
  const customers = await prisma.customer.aggregate({
    _sum: { totalBalance: true },
  });

  // Or get pending balance from sales (branch-scoped)
  const pendingSales = await prisma.sale.aggregate({
    _sum: { pendingBalance: true },
    where,
  });

  // Parse Decimal to number
  const totalIncome = Number(sales._sum.totalAmount || 0);
  const totalExpense = Number(purchases._sum.totalAmount || 0);
  const netProfit = totalIncome - totalExpense;
  const accountsReceivable = Number(customers._sum.totalBalance || 0) + Number(pendingSales._sum.pendingBalance || 0);

  return {
    totalIncome,
    totalExpense,
    netProfit,
    accountsReceivable,
  };
}

export async function getGlobalStats(data?: unknown) {
  try {
    const validated = data ? globalStatsSchema.parse(data) : {};
    const branchWhere = validated.branchId
      ? { branchId: validated.branchId }
      : {};

    const stats = await fetchStats({ ...branchWhere });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return { success: false, error: "Error al obtener estadísticas" };
  }
}

// Generic dashboard stats: type "7" | "30" | "90" computes the range internally
// (last N days); type "custom" requires startDate and endDate (valid ISO dates).
// When branchId is omitted, stats aggregate across all branches.
export async function getStats(data?: unknown) {
  try {
    const validated = statsSchema.parse(data ?? {});
    const { branchId } = validated;
    const type = validated.type ?? "30";
    const branchWhere = branchId ? { branchId } : {};

    let dateFilter: { gte: Date; lte: Date };
    if (type === "custom") {
      if (!validated.startDate || !validated.endDate) {
        return {
          success: false,
          error: "Seleccioná un rango de fechas para el periodo personalizado",
        };
      }

      const start = new Date(validated.startDate);
      const end = new Date(validated.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return { success: false, error: "Rango de fechas inválido" };
      }
      dateFilter = { gte: start, lte: end };
    } else {
      const days = Number(type);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateFilter = { gte: start, lte: end };
    }

    const stats = await fetchStats({ date: dateFilter, ...branchWhere });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { success: false, error: "Error al obtener estadísticas" };
  }
}

const performanceDataSchema = z.object({
  days: z.coerce.number().int().positive().default(30),
  branchId: z.coerce.number().int().positive().optional(),
});

// Get last N days of sales and purchases for chart
export async function getPerformanceData(data?: unknown) {
  try {
    const { days, branchId } = performanceDataSchema.parse(
      data ?? { days: 30 }
    );
    const branchWhere = branchId ? { branchId } : {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily sales
    const sales = await prisma.sale.groupBy({
      by: ["date"],
      where: {
        date: { gte: startDate },
        ...branchWhere,
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
        date: { gte: startDate },
        ...branchWhere,
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