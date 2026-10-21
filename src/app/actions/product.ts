// src/app/actions/product.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { sortProducts } from "@/lib/product-order";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNextCode } from "@/lib/utils/product-code";
import { updateProductExtendedSchema } from "@/lib/validations/product";

// Schema de validación para crear producto
// Note: stock is no longer on Product; it lives in BranchInventory per branch.
const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  description: z.string().max(500, "La descripción es muy larga").optional(),
  prefix: z.string().regex(/^[A-Za-z]{2,4}$/, "Prefijo: 2-4 letras (A-Z)").transform(v => v.toUpperCase()),
  price: z.number().min(0, "El precio no puede ser negativo"),
});

// Schema for searchProducts action
const searchProductsSchema = z.object({
  query: z.string().trim().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

// Schema para actualizar producto (code y codePrefix son READONLY; stock removido)
const updateProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo").optional(),
  description: z.string().max(500, "La descripción es muy larga").optional().nullable(),
  price: z.number().min(0, "El precio no puede ser negativo").optional(),
  // code y codePrefix NO están en el schema - son inmutables tras creación
});

// Schema para eliminar producto
const deleteProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is Prisma P2002 unique constraint violation
 */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Object && "code" in error && error.code === "P2002";
}

export async function createProduct(data: unknown) {
  try {
    const validatedData = createProductSchema.parse(data);

    // Retry logic with advisory lock to handle race conditions
    const maxRetries = 3;
    const baseDelay = 50; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const product = await prisma.$transaction(async (tx) => {
          // Advisory lock on prefix hash to prevent concurrent code generation for same prefix
          const lockKey = Math.abs(validatedData.prefix.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0));
          await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

          // Fetch existing codes for this prefix within transaction
          const existingProducts = await tx.product.findMany({
            where: { codePrefix: validatedData.prefix },
            select: { code: true },
          });

          // Generate next code using pure function (filter nulls)
          const existingCodes = existingProducts.map(p => p.code).filter((c): c is string => c !== null);
          const code = getNextCode(validatedData.prefix, existingCodes);

          // Create product with generated code (stock lives in BranchInventory)
          return await tx.product.create({
            data: {
              name: validatedData.name,
              description: validatedData.description || "-",
              price: validatedData.price,
              code,
              codePrefix: validatedData.prefix,
            },
          });
        });

        return { success: true, data: parseObject(product) };
      } catch (txError) {
        // Retry on unique constraint violation (race condition)
        if (attempt < maxRetries && isUniqueConstraintError(txError)) {
          await sleep(baseDelay * attempt); // Exponential backoff: 50ms, 100ms, 200ms
          continue;
        }
        throw txError;
      }
    }

    // Should not reach here due to throw in loop
    throw new Error("Max retries exceeded for code generation");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("agotado")) {
      return { success: false, error: error.message };
    }
    console.error("Error creating product:", error);
    return { success: false, error: "Error al crear el producto" };
  }
}

export async function getProducts(branchId?: number) {
  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(branchId ? { inventory: { some: { branchId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        inventory: {
          where: { branchId },
          select: { stock: true },
        },
      },
    });
    return { success: true, data: parseArray(products) };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, error: "Error al obtener los productos" };
  }
}

export async function getProductById(id: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }
    return { success: true, data: parseObject(product) };
  } catch (error) {
    console.error("Error fetching product:", error);
    return { success: false, error: "Error al obtener el producto" };
  }
}

export async function updateProduct(data: unknown) {
  try {
    const validatedData = updateProductSchema.parse(data);

    const product = await prisma.product.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.price !== undefined && { price: validatedData.price }),
        // code, codePrefix y stock no se actualizan aquí
      },
    });

    return { success: true, data: parseObject(product) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error updating product:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}

export async function deleteProduct(data: unknown) {
  try {
    const validatedData = deleteProductSchema.parse(data);

    await prisma.product.delete({
      where: { id: validatedData.id },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto" };
  }
}

/**
 * Search products by code or name (case-insensitive)
 * Returns max 20 results with minimal projection for performance
 * Empty query returns empty array (no default list)
 */
export async function searchProducts(data: unknown) {
  try {
    const { query, branchId } = searchProductsSchema.parse(data);

    // Empty or whitespace-only query returns empty array (no DB call)
    if (!query || query.trim() === "") {
      return { success: true, data: [] };
    }

    const products = await prisma.product.findMany({
      where: {
        // Con sucursal (ventas) solo se ofrece lo que hay en esa sucursal; sin
        // sucursal (etiquetas) no se puede filtrar por stock.
        ...(branchId ? { inventory: { some: { branchId, stock: { gt: 0 } } } } : {}),
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        inventory: {
          where: { branchId: branchId ?? undefined },
          select: { stock: true, branchId: true },
        },
      },
      take: 20,
    });

    // Flatten branch inventory into a single `stock` value per product for compatibility
    const flattened = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price,
      stock: p.inventory[0]?.stock ?? 0,
    }));

    return { success: true, data: parseArray(flattened) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error searching products:", error);
    return { success: false, error: "Error al buscar productos" };
  }
}

/**
 * Get movement history for a product (purchases and sales)
 * @param productId The product ID
 * @returns Promise resolving to an array of movement objects
 */
export async function getProductMovements(productId: number) {
  try {
    // Fetch purchases with related purchase data
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: { productId },
      include: {
        purchase: {
          select: {
            id: true,
            date: true,
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: {
        purchase: {
          date: 'desc',
        },
      },
    });

    // Fetch sales with related sale data
    const saleItems = await prisma.saleItem.findMany({
      where: { productId },
      include: {
        sale: {
          select: {
            id: true,
            date: true,
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: {
        sale: {
          date: 'desc',
        },
      },
    });

    // Libro de la sucursal: transferencias entre sucursales y ajustes de stock.
    // Las ENTRY de una compra se descartan porque esa compra ya es una fila del
    // historial (si no, la misma operación aparecería dos veces).
    const branchMovements = await prisma.branchMovement.findMany({
      where: {
        productId,
        NOT: [
          { movementType: 'ENTRY', reference: { startsWith: 'PURCHASE-' } },
          { movementType: 'EXIT', reference: { startsWith: 'SALE-' } },
        ],
      },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Map purchases to movement objects
    const purchases: ProductMovement[] = purchaseItems.map(item => ({
      id: `purchase-${item.id}`,
      type: 'PURCHASE' as const,
      date: item.purchase.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.purchase.id,
      reference: null,
      branchName: item.purchase.branch?.name ?? null,
    }));

    // Map sales to movement objects
    const sales: ProductMovement[] = saleItems.map(item => ({
      id: `sale-${item.id}`,
      type: 'SALE' as const,
      date: item.sale.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.sale.id,
      reference: null,
      branchName: item.sale.branch?.name ?? null,
    }));

    const deSucursal: ProductMovement[] = branchMovements.map(movement => ({
      id: `movement-${movement.id}`,
      type: movement.movementType,
      date: movement.createdAt.toISOString(),
      quantity: movement.quantity,
      referenceId: null,
      reference: movement.reference,
      branchName: movement.branch?.name ?? null,
    }));

    // Combine and sort by date descending
    const allMovements = [...purchases, ...sales, ...deSucursal].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return { success: true, data: parseArray(allMovements) };
  } catch (error) {
    console.error("Error fetching product movements:", error);
    return { success: false, error: "Error al obtener los movimientos del producto" };
  }
}

// Movimiento del historial de un producto: documentos (compra/venta) y
// movimientos del libro de sucursal (transferencias y ajustes).
export type ProductMovement = {
  id: string;
  type: 'PURCHASE' | 'SALE' | 'ENTRY' | 'EXIT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  date: string; // ISO string
  quantity: number;
  /** Id del documento cuando el movimiento viene de una compra o una venta. */
  referenceId: number | null;
  /** Referencia del libro de sucursal (ej. "MOVE-1699999999999", "ADJUSTMENT"). */
  reference: string | null;
  /** Sucursal donde se registró el movimiento. */
  branchName: string | null;
};

// ===========================================================================
// Fase 3: Producto activo/inactivo + actualizar extendido (categoryId, active)
// ===========================================================================

const toggleProductActiveSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  active: z.boolean(),
});

/**
 * Activa/desactiva un producto (soft-delete vía `Product.active`).
 * NO propaga `active` a `BranchInventory`: el stock persiste para historial.
 * Solo afecta los selectores (`getActiveProducts`) y el listado de inactivos.
 */
export async function toggleProductActive(data: unknown) {
  try {
    const { id, active } = toggleProductActiveSchema.parse(data);

    await prisma.product.update({
      where: { id },
      data: { active },
    });

    revalidatePath("/productos");
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error toggling product active:", error);
    return { success: false, error: "Error al actualizar el estado del producto" };
  }
}

/**
 * Productos activos (`active=true`) — para selectores y flujos de compra/venta.
 */
export async function getActiveProducts(branchId?: number) {
  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(branchId ? { inventory: { some: { branchId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        inventory: {
          where: { branchId },
          select: { stock: true },
        },
      },
    });
    return { success: true, data: parseArray(products) };
  } catch (error) {
    console.error("Error fetching active products:", error);
    return { success: false, error: "Error al obtener los productos activos" };
  }
}

/**
 * Productos inactivos (`active=false`) — para la página de inactivos.
 * El orden por defecto es por código (S4); la página ofrece el cambio a última
 * modificación sobre la lista ya cargada.
 */
export async function getInactiveProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { active: false },
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { id: true, name: true } } },
    });
    return { success: true, data: parseArray(sortProducts(products)) };
  } catch (error) {
    console.error("Error fetching inactive products:", error);
    return { success: false, error: "Error al obtener los productos inactivos" };
  }
}

/**
 * Reactiva un producto previamente desactivado (`active=true`).
 * Es un azúcar sintáctico de `toggleProductActive({id, active: true})`.
 */
export async function reactivateProduct(data: unknown) {
  const reactivateSchema = z.object({ id: z.number().int().positive("ID inválido") });
  try {
    const { id } = reactivateSchema.parse(data);

    await prisma.product.update({
      where: { id },
      data: { active: true },
    });

    revalidatePath("/productos");
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error reactivating product:", error);
    return { success: false, error: "Error al reactivar el producto" };
  }
}

/**
 * Actualización extendida del producto (Fase 3):
 * añade `categoryId` (nullable) y `active` a los campos actualizables.
 * No reemplaza `updateProduct` existente (que no incluye categoryId/active)
 * para preservar callers de HU2. `code`/`codePrefix` siguen inmutables.
 */
export async function updateProductExtended(data: unknown) {
  try {
    const validatedData = updateProductExtendedSchema.parse(data);

    const product = await prisma.product.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
        ...(validatedData.price !== undefined && { price: validatedData.price }),
        ...(validatedData.categoryId !== undefined && {
          categoryId: validatedData.categoryId,
        }),
        ...(validatedData.active !== undefined && { active: validatedData.active }),
      },
    });

    revalidatePath("/productos");
    revalidatePath(`/productos/${validatedData.id}`);
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true, data: parseObject(product) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "P2003"
    ) {
      // Foreign key constraint fail on categoryId
      return { success: false, error: "La categoría seleccionada no existe" };
    }
    console.error("Error updating product extended:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}