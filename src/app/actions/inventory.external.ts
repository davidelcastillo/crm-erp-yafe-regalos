// src/app/actions/inventory.external.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
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
    
    // Get products with their inventory details for the specific branch
    const productsWithInventory = await prisma.product.findMany({
      where: {
        inventory: {
          some: {
            branchId: branchId,
          },
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        inventory: {
          where: {
            branchId: branchId,
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

    return { success: true, data: parseArray(inventoryData) };
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