// src/app/actions/inventory.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { 
  moveStockSchema,
  moveStockBatchSchema,
  adjustStockBatchSchema,
  assignStockSchema,
  getMovementsFiltersSchema,
} from "@/lib/validations/branchMovement";
import { exportInventorySchema } from "@/lib/validations/export";
import {
  buildExportFileName,
  generateProductsPdf,
  type ProductRow,
} from "@/lib/utils/pdf";

/**
 * Fila de exportación con el id numérico del producto, requerido por
 * exportBranchProductsPdf para re-validar la membresía de la sucursal.
 */
export type ExportProductRow = ProductRow & { id: number };

const getProductStockSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  branchId: z.number().int().positive("Sucursal inválida"),
});

/**
 * Obtiene los productos que tienen stock (>0) en una sucursal específica.
 * Retorna un array de productos con su stock actual en esa sucursal.
 */
export async function getBranchInventory(data: unknown) {
  const branchStockSchema = z.object({
    branchId: z.number().int().positive("Sucursal inválida"),
  });
  try {
    const { branchId } = branchStockSchema.parse(data);
    // First, get products that have inventory entry for this branch (including stock)
    const productsWithInventory = await prisma.product.findMany({
      where: {
        active: true,
        inventory: {
          some: {
            branchId,
            stock: {
              gt: 0,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        inventory: {
          where: {
            branchId,
          },
          select: {
            stock: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    // Map to simplify
    const result = productsWithInventory.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      stock: p.inventory[0]?.stock ?? 0,
      active: p.active,
    }));
    return { success: true, data: parseArray(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    console.error('Error fetching branch inventory:', error);
    return { success: false, error: 'Error al obtener el inventario de la sucursal' };
  }
}

const adjustProductStockSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  branchId: z.number().int().positive("Sucursal inválida"),
  change: z.number().int("El cambio debe ser un entero"),
});

/**
 * Get the stock level for a product at a specific branch.
 * Returns 0 if no BranchInventory record exists yet.
 */
export async function getProductStock(data: unknown) {
  try {
    const { productId, branchId } = getProductStockSchema.parse(data);

    const inventory = await prisma.branchInventory.findUnique({
      where: {
        branchId_productId: { branchId, productId },
      },
      select: { stock: true },
    });

    const stock = inventory?.stock ?? 0;
    return { success: true, data: parseObject({ stock }) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching product stock:", error);
    return { success: false, error: "Error al obtener el stock del producto" };
  }
}

/**
 * Adjust the stock level for a product at a specific branch.
 * Positive `change` increases stock (e.g., purchases), negative decreases (e.g., sales).
 * Enforces non-negative stock; rejects if resulting stock would be negative.
 * Uses upsert to handle the case where BranchInventory record does not exist yet.
 */
export async function adjustProductStock(data: unknown) {
  try {
    const { productId, branchId, change } = adjustProductStockSchema.parse(
      data
    );

    const result = await prisma.$transaction(async (tx) => {
      // Lock the inventory row to prevent race conditions
      const existing = await tx.branchInventory.findUnique({
        where: {
          branchId_productId: { branchId, productId },
        },
      });

      const currentStock = existing?.stock ?? 0;
      const newStock = currentStock + change;

      if (newStock < 0) {
        throw new Error(
          `Stock insuficiente. Disponible: ${currentStock}, Requerido: ${Math.abs(change)}`
        );
      }

      const updated = await tx.branchInventory.upsert({
        where: {
          branchId_productId: { branchId, productId },
        },
        create: {
          branchId,
          productId,
          stock: newStock,
        },
        update: {
          stock: newStock,
        },
        select: { stock: true },
      });

      return { oldStock: currentStock, newStock: updated.stock };
    });

    revalidatePath("/inventario");
    revalidatePath("/compras");
    revalidatePath("/ventas");
    revalidatePath("/productos");

    return { success: true, data: parseObject({ newStock: result.newStock }) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    console.error("Error adjusting product stock:", error);
    return { success: false, error: "Error al ajustar el stock del producto" };
  }
}

// ===========================================================================
// Fase 3: Operaciones avanzadas de inventario
// ===========================================================================

/**
 * Productos con su stock por sucursal y categoría.
 * Joins: Product + BranchInventory + Category.
 * Opcional `categoryId` y `branchId` para filtrar.
 */
const getProductsWithBranchStockSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  branchId: z.number().int().positive().optional(),
  activeOnly: z.boolean().optional(),
  search: z.string().optional(),
  onlyWithStock: z.boolean().optional(),
});

export async function getProductsWithBranchStock(filters?: unknown) {
  try {
    const opts = getProductsWithBranchStockSchema.parse(filters ?? {});
    const where: Record<string, unknown> = {};
    if (opts.activeOnly !== false) where.active = true;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    // Filtro de sucursal a nivel where, INDEPENDIENTE de onlyWithStock.
    // El producto se devuelve si tiene al menos una fila BranchInventory en la
    // sucursal (incluye filas con stock 0). onlyWithStock añade stock > 0 en AND.
    if (opts.branchId) {
      where.inventory = {
        some: {
          branchId: opts.branchId,
          ...(opts.onlyWithStock ? { stock: { gt: 0 } } : {}),
        },
      };
    } else if (opts.onlyWithStock) {
      // Comportamiento previo sin branchId: solo productos con stock > 0
      where.inventory = { some: { stock: { gt: 0 } } };
    }
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: "insensitive" } },
        { code: { contains: opts.search, mode: "insensitive" } },
        { description: { contains: opts.search, mode: "insensitive" } },
        { category: { name: { contains: opts.search, mode: "insensitive" } } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        inventory: {
          orderBy: { branchId: "asc" },
          include: {
            branch: { select: { id: true, name: true } },
          },
          ...(opts.branchId ? { where: { branchId: opts.branchId } } : {}),
        },
      },
    });

    return { success: true, data: parseArray(products) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching products with branch stock:", error);
    return {
      success: false,
      error: "Error al obtener los productos con stock por sucursal",
    };
  }
}

/**
 * Asigna/ajusta el stock de un producto en una sucursal.
 * Útil para carga inicial, ajustes por inventario físico.
 * Usa upsert sobre la key compuesta `branchId_productId`.
 * Inserta una fila BranchMovement ADJUSTMENT (opcional).
 */
export async function assignStockToBranch(data: unknown) {
  try {
    const { productId, branchId, quantity, performedBy } =
      assignStockSchema.parse(data);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock + read inventory row
      const existing = await tx.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId } },
      });
      const currentStock = existing?.stock ?? 0;
      const newStock = currentStock + quantity;
      if (newStock < 0) {
        throw new Error(
          `Stock insuficiente. Disponible: ${currentStock}, Requerido: ${Math.abs(
            quantity
          )}`
        );
      }

      // 2. Upsert BranchInventory
      const updated = await tx.branchInventory.upsert({
        where: { branchId_productId: { branchId, productId } },
        create: { branchId, productId, stock: newStock },
        update: { stock: newStock },
        select: { stock: true },
      });

      // 3. BranchMovement ADJUSTMENT (opcional, para auditoría)
      if (performedBy) {
        await tx.branchMovement.create({
          data: {
            productId,
            branchId,
            movementType: "ADJUSTMENT",
            quantity,
            reference: "ADJUSTMENT",
            performedBy,
          },
        });
      }

      return { oldStock: currentStock, newStock: updated.stock };
    });

    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    return { success: true, data: parseObject({ newStock: result.newStock }) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    console.error("Error assigning stock:", error);
    return { success: false, error: "Error al asignar stock a la sucursal" };
  }
}

/**
 * Mueve stock de la sucursal origen a la destino.
 *
 * **Schema real**: `BranchMovement.branchId` es único (NO source/dest pair).
 * Por eso una transferencia inserta DOS filas:
 *   - `(branchId=origen, movementType=TRANSFER_OUT, quantity=n, reference=MOVE-<opId>)`
 *   - `(branchId=destino, movementType=TRANSFER_IN,  quantity=n, reference=MOVE-<opId>)`
 * Ambas con el mismo `reference` y `performedBy` (patrón libro-contable).
 */
export async function moveStockBetweenBranches(data: unknown) {
  try {
    const validatedData = moveStockSchema.parse(data);
    const { productId, sourceBranchId, destBranchId, quantity, performedBy } =
      validatedData;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar branches activas
      const [sourceBranch, destBranch] = await Promise.all([
        tx.branch.findFirst({
          where: { id: sourceBranchId, isActive: true },
          select: { id: true },
        }),
        tx.branch.findFirst({
          where: { id: destBranchId, isActive: true },
          select: { id: true },
        }),
      ]);
      if (!sourceBranch) {
        throw new Error("Sucursal de origen inactiva o inexistente");
      }
      if (!destBranch) {
        throw new Error("Sucursal de destino inactiva o inexistente");
      }

      // 2. Verificar producto activo
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, active: true, name: true },
      });
      if (!product) {
        throw new Error("Producto no encontrado");
      }

      // 3. Verificar stock disponible en origen e invariante de no-negativo
      const invSource = await tx.branchInventory.findUnique({
        where: {
          branchId_productId: { branchId: sourceBranchId, productId },
        },
      });
      const sourceStock = invSource?.stock ?? 0;
      const newSourceStock = sourceStock - quantity;
      if (newSourceStock < 0) {
        throw new Error(
          `Stock insuficiente en origen. Disponible: ${sourceStock}, Requerido: ${quantity}`
        );
      }

      // 4. Stock destino (si no existe row aún, será 0 + quantity)
      const invDest = await tx.branchInventory.findUnique({
        where: {
          branchId_productId: { branchId: destBranchId, productId },
        },
      });
      const destStock = invDest?.stock ?? 0;
      const newDestStock = destStock + quantity;

      // 5. Actualizar BranchInventory (source y dest)
      await tx.branchInventory.upsert({
        where: {
          branchId_productId: { branchId: sourceBranchId, productId },
        },
        create: { branchId: sourceBranchId, productId, stock: newSourceStock },
        update: { stock: newSourceStock },
      });
      await tx.branchInventory.upsert({
        where: {
          branchId_productId: { branchId: destBranchId, productId },
        },
        create: { branchId: destBranchId, productId, stock: newDestStock },
        update: { stock: newDestStock },
      });

      // 6. Insertar DOS BranchMovement rows (libro-contable)
      const reference = `MOVE-${Date.now()}`;
      await tx.branchMovement.create({
        data: {
          productId,
          branchId: sourceBranchId,
          movementType: "TRANSFER_OUT",
          quantity,
          reference,
          performedBy,
        },
      });
      await tx.branchMovement.create({
        data: {
          productId,
          branchId: destBranchId,
          movementType: "TRANSFER_IN",
          quantity,
          reference,
          performedBy,
        },
      });

      return {
        productId,
        reference,
        sourceBranchId,
        destBranchId,
        quantity,
        newSourceStock,
        newDestStock,
      };
    });

    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("inactiva")) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("no encontrado")) {
      return { success: false, error: error.message };
    }
    console.error("Error moving stock between branches:", error);
    return { success: false, error: "Error al mover stock entre sucursales" };
  }
}

/**
 * Mueve un LOTE de productos (con cantidades distintas) entre dos sucursales
 * en UNA operación atómica dentro de un único `$transaction`.
 *
 * Duplicación controlada del patrón de `moveStockBetweenBranches` (mismos
 * mensajes, mismo formato `MOVE-<ts>`, mismo upsert) para NO tocar la action
 * single-product existente. Verifica TODOS los ítems (sucursales activas,
 * productos activos, stock origen) ANTES del primer upsert; cualquier throw
 * aborta la transacción con rollback total.
 */
export async function moveStockBatchBetweenBranches(data: unknown) {
  try {
    const parsed = moveStockBatchSchema.parse(data);
    const { sourceBranchId, destBranchId, items, performedBy } = parsed;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar sucursales activas
      const [sourceBranch, destBranch] = await Promise.all([
        tx.branch.findFirst({
          where: { id: sourceBranchId, isActive: true },
          select: { id: true, name: true, code: true },
        }),
        tx.branch.findFirst({
          where: { id: destBranchId, isActive: true },
          select: { id: true, name: true, code: true },
        }),
      ]);
      if (!sourceBranch) {
        throw new Error("Sucursal de origen inactiva o inexistente");
      }
      if (!destBranch) {
        throw new Error("Sucursal de destino inactiva o inexistente");
      }

      // 2. Verificar productos activos (TODOS)
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true },
        select: { id: true, name: true, code: true, price: true },
      });
      if (products.length !== items.length) {
        const found = new Set(products.map((p) => p.id));
        const missing = productIds.find((id) => !found.has(id));
        throw new Error(`Producto no encontrado o inactivo: ID ${missing}`);
      }
      const nameByProductId = new Map(products.map((p) => [p.id, p.name]));

      // 3. Leer stocks de TODOS los ítems en origen (sin escribir) + validar
      const originRows = await Promise.all(
        items.map((i) =>
          tx.branchInventory.findUnique({
            where: {
              branchId_productId: { branchId: sourceBranchId, productId: i.productId },
            },
          })
        )
      );
      items.forEach((i, idx) => {
        const available = originRows[idx]?.stock ?? 0;
        if (available < i.quantity) {
          throw new Error(
            `Stock insuficiente en origen para "${nameByProductId.get(i.productId)}". Disponible: ${available}, Requerido: ${i.quantity}`
          );
        }
      });

      // 4. Leer stocks de destino (para calcular nuevos valores, sin escribir)
      const destRows = await Promise.all(
        items.map((i) =>
          tx.branchInventory.findUnique({
            where: {
              branchId_productId: { branchId: destBranchId, productId: i.productId },
            },
          })
        )
      );

      // 5. reference común a TODO el lote
      const reference = `MOVE-${Date.now()}`;

      // 6. Por ítem: upsert origen (−qty), upsert destino (+qty), 2 movements
      const itemResults: Array<{
        productId: number;
        quantity: number;
        newSourceStock: number;
        newDestStock: number;
      }> = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const newSourceStock = (originRows[i]?.stock ?? 0) - item.quantity;
        const newDestStock = (destRows[i]?.stock ?? 0) + item.quantity;

        await tx.branchInventory.upsert({
          where: {
            branchId_productId: { branchId: sourceBranchId, productId: item.productId },
          },
          create: { branchId: sourceBranchId, productId: item.productId, stock: newSourceStock },
          update: { stock: newSourceStock },
        });
        await tx.branchInventory.upsert({
          where: {
            branchId_productId: { branchId: destBranchId, productId: item.productId },
          },
          create: { branchId: destBranchId, productId: item.productId, stock: newDestStock },
          update: { stock: newDestStock },
        });
        await tx.branchMovement.create({
          data: {
            productId: item.productId,
            branchId: sourceBranchId,
            movementType: "TRANSFER_OUT",
            quantity: item.quantity,
            reference,
            performedBy,
          },
        });
        await tx.branchMovement.create({
          data: {
            productId: item.productId,
            branchId: destBranchId,
            movementType: "TRANSFER_IN",
            quantity: item.quantity,
            reference,
            performedBy,
          },
        });

        itemResults.push({
          productId: item.productId,
          quantity: item.quantity,
          newSourceStock,
          newDestStock,
        });
      }

      return {
        reference,
        sourceBranchId,
        destBranchId,
        items: itemResults,
        receipt: {
          movementType: "TRANSFER",
          date: new Date().toISOString(),
          branchName: destBranch.name,
          branchCode: destBranch.code,
          sourceBranchName: sourceBranch.name,
          sourceBranchCode: sourceBranch.code,
          reference,
          rows: itemResults.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              code: product.code, name: product.name, price: Number(product.price),
              quantity: item.quantity, stock: item.newDestStock,
            };
          }),
        } satisfies StockMovementReceipt,
      };
    });

    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("inactiva")) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("no encontrado")) {
      return { success: false, error: error.message };
    }
    console.error("Error moving stock batch between branches:", error);
    return { success: false, error: "Error al mover stock entre sucursales" };
  }
}

/**
 * ENTRADA o SALIDA de stock de un lote de productos en UNA sucursal: la forma
 * auditable de corregir stock, porque cada línea deja su `BranchMovement`
 * (`ENTRY`/`EXIT`) y el historial del producto lo muestra.
 *
 * Hermana de `moveStockBatchBetweenBranches`, que mueve entre dos sucursales
 * (`TRANSFER_OUT` + `TRANSFER_IN`): acá la sucursal es una sola y el sentido lo
 * da `movementType`.
 */
export async function adjustBranchStockBatch(data: unknown) {
  try {
    const { branchId, movementType, items, reference, performedBy } =
      adjustStockBatchSchema.parse(data);

    const result = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: branchId, isActive: true },
        select: { id: true, name: true, code: true },
      });
      if (!branch) {
        throw new Error("Sucursal inválida o inactiva");
      }

      for (const item of items) {
        if (movementType === "ENTRY") {
          await tx.branchInventory.upsert({
            where: { branchId_productId: { branchId, productId: item.productId } },
            create: { branchId, productId: item.productId, stock: item.quantity },
            update: { stock: { increment: item.quantity } },
          });
          continue;
        }

        // EXIT: decremento condicional, mismo criterio que registerSale: solo
        // descuenta si hay stock suficiente, así no queda stock negativo.
        const actualizado = await tx.branchInventory.updateMany({
          where: {
            branchId,
            productId: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (actualizado.count === 0) {
          const producto = await tx.product.findUnique({
            where: { id: item.productId },
            select: { name: true },
          });
          throw new Error(
            `Stock insuficiente para "${producto?.name ?? item.productId}" en la sucursal seleccionada`
          );
        }
      }

      // Motivo: la nota del usuario manda; si no hay, se usa el sentido (queda
      // visible en el historial del producto).
      const motivo = reference?.trim()
        ? reference.trim()
        : movementType === "ENTRY"
          ? "ENTRADA"
          : "SALIDA";

      await tx.branchMovement.createMany({
        data: items.map((item) => ({
          productId: item.productId,
          branchId,
          movementType,
          quantity: item.quantity,
          reference: motivo,
          performedBy,
        })),
      });

      // Stock resultante de todo el lote en una sola lectura (sin N+1).
      const stockFinal = await tx.branchInventory.findMany({
        where: { branchId, productId: { in: items.map((i) => i.productId) } },
        select: { productId: true, stock: true, product: { select: { code: true, name: true, price: true } } },
      });
      const stockPorProducto = new Map(stockFinal.map((f) => [f.productId, f.stock]));

      return {
        branchId,
        movementType,
        reference: motivo,
        receipt: {
          movementType,
          date: new Date().toISOString(),
          branchName: branch.name,
          branchCode: branch.code,
          reference: motivo,
          rows: items.map((item) => {
            const row = stockFinal.find((f) => f.productId === item.productId)!;
            return {
              code: row.product.code, name: row.product.name, price: Number(row.product.price),
              quantity: item.quantity, stock: row.stock,
            };
          }),
        } satisfies StockMovementReceipt,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          newStock: stockPorProducto.get(item.productId) ?? 0,
        })),
      };
    });

    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("inactiva")) {
      return { success: false, error: error.message };
    }
    console.error("Error adjusting branch stock batch:", error);
    return { success: false, error: "Error al ajustar el stock de la sucursal" };
  }
}

/**
 * Lista BranchMovement con filtros (branchId, productId, fechas).
 * Incluye join de Branch y Product para mostrar nombres en la tabla.
 */
export async function getBranchMovements(filters?: unknown) {
  try {
    const opts = getMovementsFiltersSchema.parse(filters ?? {});
    const where: Record<string, unknown> = {};
    if (opts.branchId) where.branchId = opts.branchId;
    if (opts.productId) where.productId = opts.productId;
    if (opts.startDate || opts.endDate) {
      where.createdAt = {};
      if (opts.startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(opts.startDate);
      }
      if (opts.endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(opts.endDate);
      }
    }

    const movements = await prisma.branchMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        branch: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
      take: 200, // límite para no cargar miles; paginación deferred
    });

    return { success: true, data: parseArray(movements) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching branch movements:", error);
    return { success: false, error: "Error al obtener los movimientos" };
  }
}

// ===========================================================================
// Fase 4: Exportación de inventario por sucursal
// ===========================================================================

const getBranchProductsForExportSchema = z.object({
  branchId: z.number().int().positive("Sucursal inválida"),
});

/**
 * Obtiene los productos con stock (>0) en una sucursal, proyectados como
 * ProductRow[] (code, name, stock, price) ordenados por nombre asc.
 * Útil para el paso 2 del wizard de exportación.
 */
export async function getBranchProductsForExport(data: unknown) {
  try {
    const { branchId } = getBranchProductsForExportSchema.parse(data);

    const inventory = await prisma.branchInventory.findMany({
      where: {
        branchId,
        stock: { gt: 0 },
      },
      select: {
        stock: true,
        product: {
          select: { id: true, code: true, name: true, price: true },
        },
      },
      orderBy: { product: { name: "asc" } },
    });

    const rows: ExportProductRow[] = inventory.map((inv) => ({
      id: inv.product.id,
      code: inv.product.code,
      name: inv.product.name,
      stock: inv.stock,
      price: Number(inv.product.price),
    }));

    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching products for export:", error);
    return {
      success: false,
      error: "Error al obtener los productos para exportar",
    };
  }
}

/**
 * Genera el PDF de inventario de una sucursal.
 * Valida que la sucursal exista y que TODOS los productos seleccionados
 * pertenezcan a esa sucursal con stock > 0 (re-validación server-side).
 * Si algún producto no cumple la pertenencia, rechaza SIN generar el PDF.
 */
export async function exportBranchProductsPdf(data: unknown) {
  try {
    const { branchId, selectedProductIds } = exportInventorySchema.parse(data);

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true, name: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal no encontrada" };
    }

    const inventory = await prisma.branchInventory.findMany({
      where: {
        branchId,
        productId: { in: selectedProductIds },
        stock: { gt: 0 },
      },
      select: {
        productId: true,
        stock: true,
        product: {
          select: { code: true, name: true, price: true },
        },
      },
    });

    const foundIds = new Set(inventory.map((inv) => inv.productId));
    const hasInvalid = selectedProductIds.some((id) => !foundIds.has(id));
    if (hasInvalid) {
      return {
        success: false,
        error: "Algunos productos no pertenecen a la sucursal",
      };
    }

    const rows: ProductRow[] = inventory
      .sort((a, b) => a.product.name.localeCompare(b.product.name))
      .map((inv) => ({
        code: inv.product.code,
        name: inv.product.name,
        stock: inv.stock,
        price: Number(inv.product.price),
      }));

    const exportedAt = new Date();
    const pdfBase64 = await generateProductsPdf(rows, {
      branchName: branch.name,
      branchCode: branch.code,
      date: exportedAt,
    });
    const filename = buildExportFileName(branch.code, exportedAt);

    return { success: true, data: { pdfBase64, filename } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error exporting branch inventory:", error);
    return { success: false, error: "Error al exportar el inventario" };
  }
}
