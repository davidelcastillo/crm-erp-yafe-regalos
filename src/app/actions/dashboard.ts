"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { pisosDeCaja, rangoDelUltimoCierre } from "@/lib/cash-close";
import { finDelDia, inicioDelDia, toLocalDateKey } from "@/lib/dates";
import { z } from "zod";

// Días calendario locales: `new Date("YYYY-MM-DD")` da medianoche UTC, así que el
// día final quedaba afuera y, en hora local (UTC-3), un rango de un solo día
// quedaba vacío (bug 4 del usuario).

// Días del rango, en orden, como claves de día local.
const diasDelRango = (desde: Date, hasta: Date) => {
  const dias: string[] = [];
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= hasta && dias.length < 3660) {
    dias.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
};

// Un solo rango para todo el tablero. «cierre» es el período por defecto: va
// desde el último cierre de caja (ver `rangoDelUltimoCierre`). «7» | «30» | «90»
// son los últimos N días calendario locales contando hoy; un rango de fechas
// manda sobre `days`.
async function rangoDelPeriodo(periodo: {
  type?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  branchId?: number;
}): Promise<{ success: true; desde: Date; hasta: Date } | { success: false; error: string }> {
  if (periodo.type === "cierre") {
    const rango = await rangoDelUltimoCierre(periodo.branchId);
    return { success: true, ...rango };
  }

  const conFechas = !!periodo.startDate || !!periodo.endDate;

  if (periodo.type === "custom" || conFechas) {
    if (!periodo.startDate || !periodo.endDate) {
      return {
        success: false,
        error: "Seleccioná un rango de fechas para el periodo personalizado",
      };
    }

    const desde = inicioDelDia(periodo.startDate);
    const hasta = finDelDia(periodo.endDate);
    if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || desde > hasta) {
      return { success: false, error: "Rango de fechas inválido" };
    }
    return { success: true, desde, hasta };
  }

  const dias = Math.max(1, periodo.days ?? Number(periodo.type ?? 30));
  const primerDia = new Date();
  primerDia.setDate(primerDia.getDate() - (dias - 1));
  return {
    success: true,
    desde: inicioDelDia(toLocalDateKey(primerDia)),
    hasta: finDelDia(toLocalDateKey(new Date())),
  };
}

const globalStatsSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

const statsSchema = z.object({
  type: z.enum(["cierre", "7", "30", "90", "custom"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

async function fetchStats(
  where: Record<string, unknown> = {},
  pisoVentas: Record<string, unknown> = {},
  pisoPlata: Record<string, unknown> = {},
  wherePlata: Record<string, unknown> = where
) {
  // Ventas, plata y compras se miden desde el último cierre (S21): las tarjetas
  // por defecto comparan el mismo tramo, así el neto no enfrenta el ingreso de
  // la caja nueva con todos los egresos del período. El `AND` solo aparece
  // cuando hay un cierre; sin cierres la consulta queda como estaba.
  const conPiso = (base: Record<string, unknown>, piso: Record<string, unknown>) =>
    Object.keys(piso).length > 0 ? { AND: [base, piso] } : base;
  const deCaja = conPiso(where, pisoVentas);
  // La plata de caja se mide por `createdAt`: su `date` es un día declarado, y en
  // el período del cierre la ventana es el piso, no el rango de días.
  const deCajaPlata = conPiso(wherePlata, pisoPlata);

  // Get all sales
  const sales = await prisma.sale.aggregate({
    _sum: { totalAmount: true },
    where: deCaja,
  });

  // Get all purchases
  const purchases = await prisma.purchase.aggregate({
    _sum: { totalAmount: true },
    where: deCaja,
  });

  // Cuentas por cobrar: pendiente generado en el período y la sucursal filtrados.
  // Antes sumaba la deuda global de clientes, que no sigue el filtro (bug 4).
  const pendingSales = await prisma.sale.aggregate({
    _sum: { pendingBalance: true },
    where: deCaja,
  });

  // Plata de caja (correcciones): también es balance del tablero (S18).
  const cashMovements = await prisma.cashMovement.groupBy({
    by: ["type"],
    where: deCajaPlata,
    _sum: { amount: true },
  });
  const caja = (tipo: "INGRESO" | "EGRESO") =>
    Number(cashMovements.find((c) => c.type === tipo)?._sum.amount ?? 0);

  // Parse Decimal to number
  const totalIncome = Number(sales._sum.totalAmount || 0) + caja("INGRESO");
  const totalExpense = Number(purchases._sum.totalAmount || 0) + caja("EGRESO");
  const netProfit = totalIncome - totalExpense;
  const accountsReceivable = Number(pendingSales._sum.pendingBalance || 0);

  return {
    totalIncome,
    totalExpense,
    netProfit,
    accountsReceivable,
  };
}

export async function getGlobalStats(data?: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validated = data ? globalStatsSchema.parse(data) : {};
    const branchWhere = validated.branchId
      ? { branchId: validated.branchId }
      : {};

    // Sin período no hay piso de cierre: es la vista de todo el histórico.
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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validated = statsSchema.parse(data ?? {});
    const { branchId } = validated;
    const branchWhere = branchId ? { branchId } : {};

    const rango = await rangoDelPeriodo(validated);
    if (!rango.success) {
      return { success: false, error: rango.error };
    }

    // El piso del cierre se aplica **solo** en el período «desde el último
    // cierre»: 7/30/90/personalizado muestran todo lo que cae en el rango.
    const esCierre = validated.type === "cierre";
    const { porFecha, porCarga } = esCierre
      ? await pisosDeCaja(branchId)
      : { porFecha: {}, porCarga: {} };

    const conRango = { date: { gte: rango.desde, lte: rango.hasta }, ...branchWhere };

    const stats = await fetchStats(
      conRango,
      porFecha,
      porCarga,
      // En «cierre» la plata se ubica por cuándo se cargó; el rango de días es
      // para ventas y compras, no para ella.
      esCierre ? { ...branchWhere } : conRango
    );

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
  type: z.enum(["cierre", "7", "30", "90", "custom"]).optional(),
  days: z.coerce.number().int().positive().default(30),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

// Get last N days of sales and purchases for chart
export async function getPerformanceData(data?: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validated = performanceDataSchema.parse(data ?? { days: 30 });
    const { branchId } = validated;
    const branchWhere = branchId ? { branchId } : {};

    const rango = await rangoDelPeriodo(validated);
    if (!rango.success) {
      return { success: false, error: rango.error };
    }
    const dateFilter = { gte: rango.desde, lte: rango.hasta };
    // Mismo piso de caja que las tarjetas, y solo en el período del cierre: si no,
    // los dos indicadores del tablero contarían cosas distintas.
    const esCierre = validated.type === "cierre";
    const { porFecha, porCarga } = esCierre
      ? await pisosDeCaja(branchId)
      : { porFecha: {}, porCarga: {} };

    // Get daily sales
    const sales = await prisma.sale.groupBy({
      by: ["date"],
      where: {
        AND: [{ date: dateFilter }, branchWhere, porFecha],
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
        AND: [{ date: dateFilter }, branchWhere, porFecha],
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Cada fila es un timestamp distinto, así que se acumula por día local: antes
    // se asignaba y el gráfico mostraba solo la última venta de cada día.
    const dailyData: Record<string, { income: number; expense: number }> = {};
    const bucket = (fecha: string) =>
      (dailyData[fecha] ??= { income: 0, expense: 0 });

    sales.forEach((s) => {
      bucket(toLocalDateKey(new Date(s.date))).income += Number(s._sum.totalAmount || 0);
    });

    purchases.forEach((p) => {
      bucket(toLocalDateKey(new Date(p.date))).expense += Number(p._sum.totalAmount || 0);
    });

    // La plata de caja entra en el mismo gráfico que las tarjetas (S18): si no,
    // los dos indicadores del tablero contarían cosas distintas. En el período del
    // cierre el eje y el piso miran cuándo entró la plata (`createdAt`); en los
    // períodos de días, la fecha declarada del movimiento (`date`).
    const cashMovements = esCierre
      ? await prisma.cashMovement.groupBy({
          by: ["createdAt", "type"],
          where: { AND: [branchWhere, porCarga] },
          _sum: { amount: true },
        })
      : await prisma.cashMovement.groupBy({
          by: ["date", "type"],
          where: { AND: [{ date: dateFilter }, branchWhere] },
          _sum: { amount: true },
        });

    cashMovements.forEach((c) => {
      const cuando = "createdAt" in c ? c.createdAt : c.date;
      const dia = bucket(toLocalDateKey(new Date(cuando)));
      const monto = Number(c._sum.amount || 0);
      if (c.type === "INGRESO") dia.income += monto;
      else dia.expense += monto;
    });

    // Un punto por día del rango, en orden, incluso los días sin movimientos.
    const chartData = diasDelRango(rango.desde, rango.hasta).map((date) => ({
      date,
      income: dailyData[date]?.income ?? 0,
      expense: dailyData[date]?.expense ?? 0,
    }));

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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

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