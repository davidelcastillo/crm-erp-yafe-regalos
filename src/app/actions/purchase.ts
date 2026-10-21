"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createPurchaseWithBranchSplitSchema,
  type CreatePurchaseWithBranchSplitValues,
} from "@/lib/validations/purchase";

// Schema para un item de compra
const purchaseItemSchema = z.object({
  productId: z.coerce.number().int().positive("Producto inválido"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});

// Schema para registrar una compra con múltiples productos
// branchId es obligatorio: el inventario recibido se asigna a esa sucursal
const registerPurchaseSchema = z.object({
  items: z.array(purchaseItemSchema).min(1),
  branchId: z.coerce.number().int().positive("La sucursal es requerida"),
});

export async function registerPurchase(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = registerPurchaseSchema.parse(data);

    // Verify the branch exists and is active before processing
    const branch = await prisma.branch.findFirst({
      where: { id: validatedData.branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal inválida o inactiva" };
    }

    // Calcular el total
    const totalAmount = validatedData.items.reduce((sum: number, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    // Usar transacción para crear la compra Y aumentar el stock atómicamente
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro de compra (cabecera) con branchId
      const purchase = await tx.purchase.create({
        data: {
          totalAmount,
          branchId: validatedData.branchId,
        },
      });

      // 2. Crear los items
      const itemsData = validatedData.items.map((item) => ({
        purchaseId: purchase.id,
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      }));

      // Crear todos los PurchaseItem
      await tx.purchaseItem.createMany({
        data: itemsData,
      });

      // 3. Aumentar el stock en BranchInventory (upsert: crea si no existe)
      for (const item of validatedData.items) {
        await tx.branchInventory.upsert({
          where: {
            branchId_productId: {
              branchId: validatedData.branchId,
              productId: item.productId,
            },
          },
          create: {
            branchId: validatedData.branchId,
            productId: item.productId,
            stock: item.quantity,
          },
          update: {
            stock: { increment: item.quantity },
          },
        });
      }

      // Obtener los items creados para retornar
      const createdItems = await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id },
        include: { product: true },
      });

      return { purchase, items: createdItems, totalAmount };
    });

    // Revalidate cache
    revalidatePath("/compras");
    revalidatePath("/inventario");

    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error registering purchase:", error);
    return { success: false, error: "Error al registrar la compra" };
  }
}

// Schema para obtener compras (opcionalmente filtradas por branch)
const getPurchasesSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

export async function getPurchases(filters?: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedFilters = filters ? getPurchasesSchema.parse(filters) : {};
    
    const where: Record<string, unknown> = {};
    
    if (validatedFilters.branchId) {
      where.branchId = validatedFilters.branchId;
    }
    
    if (validatedFilters.startDate || validatedFilters.endDate) {
      where.date = {};
      if (validatedFilters.startDate) {
        (where.date as Record<string, Date>).gte = new Date(validatedFilters.startDate);
      }
      if (validatedFilters.endDate) {
        (where.date as Record<string, Date>).lte = new Date(validatedFilters.endDate);
      }
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // Add formatted date string to prevent hydration mismatch
    const purchasesWithFormattedDate = purchases.map(p => ({
      ...p,
      formattedDate: new Date(p.date).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return { success: true, data: parseArray(purchasesWithFormattedDate) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching purchases:", error);
    return { success: false, error: "Error al obtener las compras" };
  }
}

export async function getPurchaseById(id: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    if (!purchase) {
      return { success: false, error: "Compra no encontrada" };
    }
    
    return { success: true, data: parseObject(purchase) };
  } catch (error) {
    console.error("Error fetching purchase:", error);
    return { success: false, error: "Error al obtener la compra" };
  }
}

// ===========================================================================
// Fase 3: Compra con distribución multi-sucursal (NO reemplaza registerPurchase)
// ===========================================================================

/**
 * Crea una compra con items distribuidos a múltiples sucursales.
 *
 * Restricción del schema: `Purchase.branchId` es NOT NULL, por lo que la
 * cabecera adopta el `branchId` de la PRIMERA línea como cabecera. Todas las
 * líneas de items pueden ir a distintas sucursales. Se validan:
 *   - las branches involucradas existan y estén activas;
 *   - los productos existan y estén activos.
 * En cada `branchId` destino, se crea los `PurchaseItem`, se incrementa
 * `BranchInventory`, y se insertan movimientos `BranchMovement(ENTRY)` por
 * línea para reflejar la distribución (audit trail).
 *
 * Las escrituras van agrupadas (un `INSERT` por tabla) para que la cantidad de
 * viajes a la base no crezca con la cantidad de líneas: la transacción
 * interactiva tiene un tope de tiempo y con ~3 viajes por ítem una compra de 25
 * líneas se cortaba en el pooler remoto con el error genérico. (Bug 6)
 */

/**
 * Tope de la transacción interactiva (el default de Prisma son 5 s). Con las
 * escrituras agrupadas el caso reportado de 25 líneas pasa de 82 queries a 10
 * (incluye validación, BEGIN y COMMIT), así que 20 s es solo la red de
 * seguridad para una conexión lenta, no el arreglo.
 */
const PURCHASE_TRANSACTION_TIMEOUT_MS = 20_000;

// Códigos de error transitorio de Prisma (pool/conexión/timeout) que se
// reintentan de forma acotada. (FIX-FASE4 issue 3)
const PRISMA_TRANSIENT_ERROR_CODES = new Set(["P1001", "P1008", "P2024", "P2034"]);
const MAX_PURCHASE_RETRIES = 3;

function getPrismaErrorCode(error: unknown): string | undefined {
  if (error instanceof Object && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function isPrismaTransientError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  return code !== undefined && PRISMA_TRANSIENT_ERROR_CODES.has(code);
}

/**
 * Núcleo transaccional de la compra con distribución multi-sucursal.
 * Recibe data ya validada (zod + branches + productos activos) y ejecuta la
 * transacción atómica. La validación ocurre ANTES de la transacción, por lo
 * que los reintentos nunca re-ejecutan validación.
 */
async function executePurchase(validatedData: CreatePurchaseWithBranchSplitValues) {
  const { items, performedBy } = validatedData;

  // 4. Total a partir de las líneas
  const totalAmount = items.reduce(
    (sum: number, it) => sum + it.price * it.quantity,
    0
  );

  // 5. El branchId de la cabecera propietaria a la cabecera de la primera línea (NOT NULL)
  const headBranchId = items[0].branchId;

  // 6. Transacción atómica
  const result = await prisma.$transaction(
    async (tx) => {
      // a. Cabecera de la compra
      const purchase = await tx.purchase.create({
        data: { totalAmount, branchId: headBranchId },
      });

      // b. Todas las líneas en un solo INSERT
      await tx.purchaseItem.createMany({
        data: items.map((it) => ({
          purchaseId: purchase.id,
          productId: it.productId,
          price: it.price,
          quantity: it.quantity,
          subtotal: it.price * it.quantity,
        })),
      });

      // c. Inventario: un solo INSERT ... ON CONFLICT DO UPDATE que incrementa el
      // stock de cada par (branchId, productId). Los pares repetidos se suman
      // antes porque la sentencia no puede impactar la misma fila dos veces.
      const stockPorPar = new Map<
        string,
        { branchId: number; productId: number; quantity: number }
      >();
      for (const it of items) {
        const clave = `${it.branchId}:${it.productId}`;
        const acumulado = stockPorPar.get(clave);
        if (acumulado) {
          acumulado.quantity += it.quantity;
        } else {
          stockPorPar.set(clave, {
            branchId: it.branchId,
            productId: it.productId,
            quantity: it.quantity,
          });
        }
      }
      // `lastUpdated` es @updatedAt: en SQL crudo hay que escribirlo a mano.
      const filasStock = Array.from(stockPorPar.values()).map(
        (fila) =>
          Prisma.sql`(${fila.branchId}, ${fila.productId}, ${fila.quantity}, NOW())`
      );
      await tx.$executeRaw`
        INSERT INTO "BranchInventory" ("branchId", "productId", "stock", "lastUpdated")
        VALUES ${Prisma.join(filasStock)}
        ON CONFLICT ("branchId", "productId")
        DO UPDATE SET
          "stock" = "BranchInventory"."stock" + EXCLUDED."stock",
          "lastUpdated" = EXCLUDED."lastUpdated"
      `;

      // d. Movimientos ENTRY por línea para auditar la distribución
      if (performedBy) {
        await tx.branchMovement.createMany({
          data: items.map((it) => ({
            productId: it.productId,
            branchId: it.branchId,
            movementType: "ENTRY",
            quantity: it.quantity,
            reference: `PURCHASE-${purchase.id}`,
            performedBy,
          })),
        });
      }

      // e. Devolver cabecera + items creados
      const createdItems = await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id },
        include: { product: { select: { id: true, name: true, code: true } } },
      });
      return { purchase, items: createdItems, totalAmount };
    },
    { timeout: PURCHASE_TRANSACTION_TIMEOUT_MS }
  );

  return result;
}

/**
 * Ejecuta `executePurchase` con reintentos acotados (hasta 3 intentos) ante
 * errores transitorios de Prisma (P1001/P1008/P2024/P2034). El primer fallo se
 * registra en log con el error crudo y la forma del input validado
 * (branchIds/productIds, sin secretos) para confirmar el disparador real del
 * issue 3. Los errores no transitorios se propagan inmediatamente.
 */
async function executePurchaseWithRetry(
  validatedData: CreatePurchaseWithBranchSplitValues
): Promise<Awaited<ReturnType<typeof executePurchase>>> {
  for (let attempt = 1; attempt <= MAX_PURCHASE_RETRIES; attempt++) {
    try {
      return await executePurchase(validatedData);
    } catch (error) {
      const transient = isPrismaTransientError(error);

      if (attempt === 1 && transient) {
        console.error(
          "createPurchaseWithBranchSplit: primer intento falló, reintentando",
          {
            code: getPrismaErrorCode(error),
            message: error instanceof Error ? error.message : String(error),
            branchIds: Array.from(new Set(validatedData.items.map((it) => it.branchId))),
            productIds: Array.from(new Set(validatedData.items.map((it) => it.productId))),
          }
        );
      }

      if (!transient || attempt === MAX_PURCHASE_RETRIES) {
        throw error;
      }

      // Backoff ~100ms por intento
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
  // Inalcanzable: el bucle siempre retorna o lanza
  throw new Error("Unexpected fall-through in purchase retry");
}

/**
 * Crea una compra con items distribuidos a múltiples sucursales.
 */
export async function createPurchaseWithBranchSplit(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = createPurchaseWithBranchSplitSchema.parse(data);
    const { items } = validatedData;

    // 1. Branches únicas involucradas
    const branchIds = Array.from(
      new Set(items.map((it) => it.branchId))
    );

    // 2. Verificar branch(es) activas
    const activeBranches = await prisma.branch.findMany({
      where: { id: { in: branchIds }, isActive: true },
      select: { id: true },
    });
    const activeBranchIds = new Set(activeBranches.map((b) => b.id));
    for (const id of branchIds) {
      if (!activeBranchIds.has(id)) {
        return {
          success: false,
          error: `Sucursal ${id} inválida o inactiva`,
        };
      }
    }

    // 3. Verificar productos activos
    const productIds = Array.from(new Set(items.map((it) => it.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, active: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) {
        return { success: false, error: `Producto ${it.productId} no encontrado` };
      }
      if (!p.active) {
        return { success: false, error: `Producto "${p.name}" está inactivo` };
      }
    }

    // 4-6. Ejecutar la transacción atómica con reintentos acotados (issue 3)
    const result = await executePurchaseWithRetry(validatedData);

    revalidatePath("/compras");
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
    console.error("Error registering purchase with branch split:", error);
    return { success: false, error: "Error al registrar la compra con distribución" };
  }
}