// src/app/actions/product.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { z } from "zod";
import { getNextCode } from "@/lib/utils/product-code";

// Schema de validación para crear producto
const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  description: z.string().max(500, "La descripción es muy larga").optional(),
  stock: z.number().int().min(0, "El stock no puede ser negativo").default(0),
  prefix: z.string().regex(/^[A-Za-z]{2,4}$/, "Prefijo: 2-4 letras (A-Z)").transform(v => v.toUpperCase()),
  price: z.number().min(0, "El precio no puede ser negativo"),
});

// Schema for searchProducts action
const searchProductsSchema = z.object({
  query: z.string().trim().optional(),
});

// Schema para actualizar producto (code y codePrefix son READONLY)
const updateProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo").optional(),
  description: z.string().max(500, "La descripción es muy larga").optional().nullable(),
  stock: z.number().int().min(0, "El stock no puede ser negativo").optional(),
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

          // Create product with generated code
          return await tx.product.create({
            data: {
              name: validatedData.name,
              description: validatedData.description || "-",
              stock: validatedData.stock,
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

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
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
        ...(validatedData.stock !== undefined && { stock: validatedData.stock }),
        ...(validatedData.price !== undefined && { price: validatedData.price }),
        // code y codePrefix NO se actualizan - son inmutables
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
    const { query } = searchProductsSchema.parse(data);

    // Empty or whitespace-only query returns empty array (no DB call)
    if (!query || query.trim() === "") {
      return { success: true, data: [] };
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true, price: true, stock: true },
      take: 20,
    });

    return { success: true, data: parseArray(products) };
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
          },
        },
      },
      orderBy: {
        sale: {
          date: 'desc',
        },
      },
    });

    // Map purchases to movement objects
    const purchases: Movement[] = purchaseItems.map(item => ({
      id: `purchase-${item.id}`,
      type: 'PURCHASE' as const,
      date: item.purchase.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.purchase.id,
    }));

    // Map sales to movement objects
    const sales: Movement[] = saleItems.map(item => ({
      id: `sale-${item.id}`,
      type: 'SALE' as const,
      date: item.sale.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.sale.id,
    }));

    // Combine and sort by date descending
    const allMovements = [...purchases, ...sales].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return { success: true, data: parseArray(allMovements) };
  } catch (error) {
    console.error("Error fetching product movements:", error);
    return { success: false, error: "Error al obtener los movimientos del producto" };
  }
}

// Define the movement type for the response
type Movement = {
  id: string;
  type: 'PURCHASE' | 'SALE';
  date: string; // ISO string
  quantity: number;
  referenceId: number;
};