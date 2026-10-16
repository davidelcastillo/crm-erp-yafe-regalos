// src/app/actions/cash.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { inicioDelDia, finDelDia } from "@/lib/dates";
import {
  cashClosePreviewSchema,
  closeCashSchema,
  getCashMovementsSchema,
  registerCashMovementSchema,
} from "@/lib/validations/cash";

/**
 * Plata de la caja de una sucursal fuera de una venta: correcciones de dinero
 * (S14 del usuario: «agreguemos la opcion de hacer el CashMovement tambien»).
 *
 * El movimiento lleva **fecha propia**, elegible al cargar (S18), y entra en el
 * balance del tablero (`fetchStats` en `dashboard.ts`). No toca stock ni ventas.
 */

export async function registerCashMovement(data: unknown) {
  try {
    const validado = registerCashMovementSchema.parse(data);

    // La sucursal tiene que existir y estar activa, como en las ventas.
    const branch = await prisma.branch.findFirst({
      where: { id: validado.branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal inválida o inactiva" };
    }

    const movimiento = await prisma.cashMovement.create({
      data: {
        branchId: validado.branchId,
        type: validado.type,
        method: validado.method,
        amount: validado.amount,
        date: validado.date ? inicioDelDia(validado.date) : new Date(),
        description: validado.description?.trim() || null,
        performedBy: validado.performedBy,
      },
    });

    revalidatePath("/ventas");
    revalidatePath("/dashboard");

    return { success: true, data: parseObject(movimiento) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error registrando el movimiento de caja:", error);
    return { success: false, error: "Error al registrar el movimiento de caja" };
  }
}

export async function getCashMovements(filters?: unknown) {
  try {
    const validado = filters ? getCashMovementsSchema.parse(filters) : {};

    const where: Record<string, unknown> = {};
    if (validado.branchId) where.branchId = validado.branchId;
    if (validado.startDate || validado.endDate) {
      const rango: Record<string, Date> = {};
      if (validado.startDate) rango.gte = inicioDelDia(validado.startDate);
      if (validado.endDate) rango.lte = finDelDia(validado.endDate);
      where.date = rango;
    }

    const [items, porTipo] = await Promise.all([
      prisma.cashMovement.findMany({
        where,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: validado.take ?? 50,
      }),
      // Los totales son del filtro completo, no de la página listada.
      prisma.cashMovement.groupBy({
        by: ["type"],
        where,
        _sum: { amount: true },
      }),
    ]);

    const suma = (tipo: "INGRESO" | "EGRESO") =>
      Number(porTipo.find((t) => t.type === tipo)?._sum.amount ?? 0);
    const ingresos = suma("INGRESO");
    const egresos = suma("EGRESO");

    return {
      success: true,
      data: {
        items: parseArray(items),
        totals: { ingresos, egresos, balance: ingresos - egresos },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error obteniendo los movimientos de caja:", error);
    return { success: false, error: "Error al obtener los movimientos de caja" };
  }
}

/**
 * Totales de la **caja abierta** de una sucursal: las ventas posteriores a su
 * último cierre, separadas por método de pago. `MIXTO` va en su propia línea
 * porque la venta no guarda cuánto fue efectivo y cuánto transferencia.
 */
const totalesDeCaja = async (db: Prisma.TransactionClient, branchId: number) => {
  const ultimoCierre = await db.cashClose.findFirst({
    where: { branchId },
    orderBy: { closedAt: "desc" },
  });

  const ventas = await db.sale.groupBy({
    by: ["paymentMethod"],
    where: {
      branchId,
      ...(ultimoCierre ? { date: { gt: ultimoCierre.closedAt } } : {}),
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  const porMetodo = (metodo: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO") =>
    Number(ventas.find((v) => v.paymentMethod === metodo)?._sum.totalAmount ?? 0);

  const cashTotal = porMetodo("EFECTIVO");
  const transferTotal = porMetodo("TRANSFERENCIA");
  const mixedTotal = porMetodo("MIXTO");

  return {
    since: ultimoCierre?.closedAt ?? null,
    cashTotal,
    transferTotal,
    mixedTotal,
    total: cashTotal + transferTotal + mixedTotal,
    salesCount: ventas.reduce((acc, v) => acc + v._count, 0),
  };
};

/** Lo que el cierre va a mostrar antes de confirmarlo (S9). */
export async function getCashClosePreview(data: unknown) {
  try {
    const validado = cashClosePreviewSchema.parse(data);

    const branch = await prisma.branch.findFirst({
      where: { id: validado.branchId, isActive: true },
      select: { id: true, name: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal inválida o inactiva" };
    }

    const totales = await totalesDeCaja(prisma, validado.branchId);

    return {
      success: true,
      data: {
        branchName: branch.name,
        since: totales.since ? totales.since.toISOString() : null,
        cashTotal: totales.cashTotal,
        transferTotal: totales.transferTotal,
        mixedTotal: totales.mixedTotal,
        total: totales.total,
        salesCount: totales.salesCount,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error calculando el cierre de caja:", error);
    return { success: false, error: "Error al calcular el cierre de caja" };
  }
}

/**
 * Cierra la caja de una sucursal: guarda el corte. A partir de ahí esas ventas
 * son «caja anterior» — el listado las oscurece y los indicadores arrancan de
 * cero — y las ventas no se tocan (S17: el cierre ordena la plata, no el stock).
 */
export async function closeCash(data: unknown) {
  try {
    const validado = closeCashSchema.parse(data);

    const branch = await prisma.branch.findFirst({
      where: { id: validado.branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal inválida o inactiva" };
    }

    // Los totales se leen y el corte se guarda en la misma transacción: el
    // cierre es un instante, no un rango que se mueve mientras se cierra.
    const cierre = await prisma.$transaction(async (tx) => {
      const totales = await totalesDeCaja(tx, validado.branchId);

      return tx.cashClose.create({
        data: {
          branchId: validado.branchId,
          closedBy: validado.performedBy,
          cashTotal: totales.cashTotal,
          transferTotal: totales.transferTotal,
          mixedTotal: totales.mixedTotal,
          total: totales.total,
        },
      });
    });

    revalidatePath("/ventas");
    revalidatePath("/dashboard");

    return { success: true, data: parseObject(cierre) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error cerrando la caja:", error);
    return { success: false, error: "Error al cerrar la caja" };
  }
}

