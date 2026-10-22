// src/app/actions/stockControl.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { parseObject } from "@/lib/parse-prisma";
import { sortProducts } from "@/lib/product-order";
import type {
  StockControlDecision,
  StockControlReceipt,
} from "@/lib/stock-control-receipt";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  startStockControlSchema,
  getStockControlSchema,
  saveStockControlCountsSchema,
  closeStockControlSchema,
  getLastClosedStockControlSchema,
} from "@/lib/validations/stockControl";

/**
 * Control de stock por sucursal (S1, S2, S9, S11).
 *
 * Un control es un evento manual: se abre un `DRAFT` con el stock del sistema,
 * se cargan los conteos y al cerrar se ajusta **solo** lo que el usuario aceptó.
 * Las diferencias pendientes quedan registradas sin tocar stock para poder
 * seguir buscando la mercadería; si aparece, se registra una entrada como hoy.
 */

function zodFailure(error: z.ZodError) {
  return {
    success: false as const,
    error: error.issues.map((e) => e.message).join(", "),
  };
}

/** El stock y los movimientos cambian: se refrescan las tres vistas afectadas. */
function revalidateStockViews() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/control");
  revalidatePath("/movimientos");
}

const controlNotFound = { success: false as const, error: "Control no encontrado" };
const alreadyClosed = {
  success: false as const,
  error: "El control ya está cerrado",
};

/**
 * El cierre se reclama dentro de la transacción: si otro proceso lo cerró
 * primero, la guarda no afecta ninguna fila y se aborta sin tocar stock.
 */
class AlreadyClosedError extends Error {}

/**
 * Abre el borrador de control de una sucursal con un ítem por cada producto
 * activo que tenga fila en `BranchInventory`, con el stock actual como
 * `systemStock` y como primer conteo. Si la sucursal ya tiene un borrador, se
 * reutiliza: nunca hay dos `DRAFT` abiertos a la vez.
 */
export async function startStockControl(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { branchId } = startStockControlSchema.parse(data);

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) {
      return { success: false as const, error: "Sucursal no encontrada" };
    }

    const draft = await prisma.stockControl.findFirst({
      where: { branchId, status: "DRAFT" },
      orderBy: { startedAt: "desc" },
      select: { id: true, branchId: true, status: true, startedAt: true },
    });
    if (draft) {
      return {
        success: true as const,
        data: parseObject({
          controlId: draft.id,
          branchId: draft.branchId,
          status: draft.status,
          startedAt: draft.startedAt,
          reused: true,
        }),
      };
    }

    const inventory = await prisma.branchInventory.findMany({
      where: { branchId, product: { active: true } },
      select: { productId: true, stock: true },
    });

    const created = await prisma.stockControl.create({
      data: {
        branchId,
        items: {
          create: inventory.map((row) => ({
            productId: row.productId,
            systemStock: row.stock,
            countedStock: row.stock,
            decision: "PENDING" as const,
          })),
        },
      },
      select: { id: true, branchId: true, status: true, startedAt: true },
    });

    revalidateStockViews();

    return {
      success: true as const,
      data: parseObject({
        controlId: created.id,
        branchId: created.branchId,
        status: created.status,
        startedAt: created.startedAt,
        reused: false,
      }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error);
    console.error("Error starting stock control:", error);
    return { success: false as const, error: "Error al iniciar el control de stock" };
  }
}

/** Control con su sucursal y sus ítems, para la pantalla de conteo. */
export async function getStockControl(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { controlId } = getStockControlSchema.parse(data);

    const control = await prisma.stockControl.findUnique({
      where: { id: controlId },
      select: {
        id: true,
        branchId: true,
        status: true,
        startedAt: true,
        closedAt: true,
        closedBy: true,
        reason: true,
        branch: { select: { name: true, code: true } },
        items: {
          select: {
            productId: true,
            systemStock: true,
            countedStock: true,
            decision: true,
            product: { select: { code: true, name: true, price: true } },
          },
        },
      },
    });
    if (!control) return controlNotFound;

    // Prisma no ordena natural por el sufijo numérico: se ordena en memoria.
    const items = sortProducts(
      control.items.map((item) => ({
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        price: Number(item.product.price),
        systemStock: item.systemStock,
        countedStock: item.countedStock,
        decision: item.decision,
      }))
    );

    return {
      success: true as const,
      data: parseObject({
        id: control.id,
        branchId: control.branchId,
        branchName: control.branch.name,
        branchCode: control.branch.code,
        status: control.status,
        startedAt: control.startedAt,
        closedAt: control.closedAt,
        closedBy: control.closedBy,
        reason: control.reason,
        items,
      }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error);
    console.error("Error fetching stock control:", error);
    return { success: false as const, error: "Error al obtener el control de stock" };
  }
}

/**
 * Guarda los conteos y las decisiones de un borrador. Un control cerrado es
 * historia: no se reescribe.
 */
export async function saveStockControlCounts(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { controlId, items, reason } = saveStockControlCountsSchema.parse(data);

    const control = await prisma.stockControl.findUnique({
      where: { id: controlId },
      select: { id: true, status: true },
    });
    if (!control) return controlNotFound;
    if (control.status === "CLOSED") return alreadyClosed;

    const saved = await prisma.$transaction(async (tx) => {
      // El motivo viaja con el borrador: retomarlo tiene que devolver el texto ya
      // escrito, no un campo vacío (S10).
      const texto = reason?.trim() ?? "";
      if (texto) {
        await tx.stockControl.update({ where: { id: controlId }, data: { reason: texto } });
      }

      let count = 0;
      for (const item of items) {
        const result = await tx.stockControlItem.updateMany({
          where: { controlId, productId: item.productId },
          data: { countedStock: item.countedStock, decision: item.decision },
        });
        count += result.count;
      }
      return count;
    });

    revalidateStockViews();

    return { success: true as const, data: { saved } };
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error);
    console.error("Error saving stock control counts:", error);
    return { success: false as const, error: "Error al guardar el conteo" };
  }
}

type CountedItem = {
  productId: number;
  code: string;
  name: string;
  systemStock: number;
  countedStock: number;
  decision: StockControlDecision;
};

/**
 * Cierra el control (S2, S6, S9, S11).
 *
 * Dentro de una transacción, por cada diferencia **aceptada**: el stock de la
 * sucursal queda en lo contado (valor absoluto) y se registra un `ADJUSTMENT`
 * con la diferencia firmada. Los pendientes y las diferencias 0 no generan
 * movimiento: el teórico sigue a la vista para encontrar la mercadería.
 */
export async function closeStockControl(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { controlId, reason } = closeStockControlSchema.parse(data);
    const trimmedReason = reason?.trim() ?? "";

    const control = await prisma.stockControl.findUnique({
      where: { id: controlId },
      select: {
        id: true,
        branchId: true,
        status: true,
        branch: { select: { name: true, code: true } },
        items: {
          select: {
            productId: true,
            systemStock: true,
            countedStock: true,
            decision: true,
            product: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!control) return controlNotFound;
    if (control.status === "CLOSED") return alreadyClosed;

    const counted: CountedItem[] = control.items.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      systemStock: item.systemStock,
      countedStock: item.countedStock,
      decision: item.decision,
    }));
    const differences = counted.filter(
      (item) => item.countedStock !== item.systemStock
    );
    const accepted = differences.filter((item) => item.decision === "ACCEPTED");
    const pending = differences.filter((item) => item.decision === "PENDING");

    // Ajustar stock sin explicar por qué no es aceptable (S10).
    if (accepted.length > 0 && !trimmedReason) {
      return {
        success: false as const,
        error: "El motivo del ajuste es obligatorio",
      };
    }

    const closedAt = new Date();

    await prisma.$transaction(async (tx) => {
      // El `status` de arriba es una lectura previa: dos cierres simultáneos del
      // mismo control ajustarían el stock dos veces. El cierre se reclama con un
      // updateMany condicionado, así que el segundo no encuentra qué actualizar y
      // la transacción se cae sin haber tocado nada.
      const claimed = await tx.stockControl.updateMany({
        where: { id: control.id, status: "DRAFT" },
        data: {
          status: "CLOSED",
          closedAt,
          closedBy: auth.email,
          reason: trimmedReason || null,
        },
      });
      if (claimed.count === 0) throw new AlreadyClosedError();

      for (const item of accepted) {
        await tx.branchInventory.upsert({
          where: {
            branchId_productId: {
              branchId: control.branchId,
              productId: item.productId,
            },
          },
          create: {
            branchId: control.branchId,
            productId: item.productId,
            stock: item.countedStock,
          },
          update: { stock: item.countedStock },
        });

        await tx.branchMovement.create({
          data: {
            productId: item.productId,
            branchId: control.branchId,
            movementType: "ADJUSTMENT",
            quantity: item.countedStock - item.systemStock,
            reference: `CONTROL-${control.id}`,
            performedBy: auth.email,
          },
        });
      }
    });

    revalidateStockViews();

    const receipt: StockControlReceipt = {
      controlId: control.id,
      branchId: control.branchId,
      branchName: control.branch.name,
      branchCode: control.branch.code,
      closedAt: closedAt.toISOString(),
      reason: trimmedReason || null,
      adjustedCount: accepted.length,
      pendingCount: pending.length,
      items: sortProducts(
        differences.map((item) => ({
          code: item.code,
          name: item.name,
          systemStock: item.systemStock,
          countedStock: item.countedStock,
          difference: item.countedStock - item.systemStock,
          decision: item.decision,
        }))
      ),
    };

    return { success: true as const, data: { receipt: parseObject(receipt) } };
  } catch (error) {
    if (error instanceof AlreadyClosedError) return alreadyClosed;
    if (error instanceof z.ZodError) return zodFailure(error);
    console.error("Error closing stock control:", error);
    return { success: false as const, error: "Error al cerrar el control de stock" };
  }
}

/**
 * Último control cerrado de la sucursal, o `null` si nunca hubo. Es el corte de
 * «movimientos desde el último control» (S3, S4): una sola fila, la más
 * reciente.
 */
export async function getLastClosedStockControl(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { branchId } = getLastClosedStockControlSchema.parse(data);

    const last = await prisma.stockControl.findFirst({
      where: { branchId, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      select: { id: true, closedAt: true, closedBy: true },
    });

    return { success: true as const, data: last ? parseObject(last) : null };
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error);
    console.error("Error fetching last closed stock control:", error);
    return {
      success: false as const,
      error: "Error al obtener el último control de stock",
    };
  }
}
