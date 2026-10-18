// src/app/actions/inventory.external.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray } from "@/lib/parse-prisma";
import { z } from "zod";

/**
 * Obtiene el inventario detallado de una sucursal específica para el portal externo.
 * Retorna un array de productos con código, nombre, stock y precio.
 */
export async function getExternalBranchInventory(data: unknown) {
  const branchIdSchema = z.object({
    branchId: z.number().int().positive("Sucursal inválida"),
  });

  try {
    const { branchId } = branchIdSchema.parse(data);

    // Visibility check: the catalog is public only for branches that exist,
    // are marked isPublic AND are active. The same `success: false` is
    // returned for non-public, inactive and non-existent branches so the
    // reason is never leaked. This applies to every role (admin included).
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true, isPublic: true, isActive: true },
    });

    if (!branch || !branch.isPublic || !branch.isActive) {
      return { success: false };
    }

    // Get active products with their inventory details for the specific branch
    const productsWithInventory = await prisma.product.findMany({
      where: {
        active: true,
        inventory: {
          some: {
            branchId: branchId,
            stock: { gt: 0 },
          },
        },
      },
      select: {
        code: true,
        name: true,
        price: true,
        inventory: {
          where: {
            branchId: branchId,
            stock: { gt: 0 },
          },
          select: {
            stock: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format the data for the external portal
    const inventoryData = productsWithInventory
      .map(product => {
        const inventoryEntry = product.inventory[0];
        if (!inventoryEntry) return null;
        
        return {
          code: product.code,
          name: product.name,
          stock: inventoryEntry.stock,
          price: product.price,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // El nombre va al lado de los datos: la página lo usa en el título (el id no
    // le dice nada a quien mira el catálogo).
    return { success: true, data: parseArray(inventoryData), branchName: branch.name };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    console.error('Error fetching external branch inventory:', error);
    return { success: false, error: 'Error al obtener el inventario externo de la sucursal' };
  }
}