"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Schema para un item de compra
const purchaseItemSchema = z.object({
  productId: z.coerce.number().int().positive("Producto inválido"),
  price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});

// Schema para registrar una compra con múltiples productos
const registerPurchaseSchema = z.object({
  items: z.array(purchaseItemSchema).min(1),
});

export async function registerPurchase(data: unknown) {
  try {
    const validatedData = registerPurchaseSchema.parse(data);

    // Calcular el total
    const totalAmount = validatedData.items.reduce((sum: number, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    // Usar transacción para crear la compra Y aumentar el stock atómicamente
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro de compra (cabecera)
      const purchase = await tx.purchase.create({
        data: {
          totalAmount,
        },
      });

      // 2. Crear los items y aumentar el stock
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

      // 3. Aumentar el stock de cada producto
      for (const item of validatedData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
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

    // Revalidate cache for the compras and inventario pages
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

// Schema para obtener compras
const getPurchasesSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function getPurchases(filters?: unknown) {
  try {
    const validatedFilters = filters ? getPurchasesSchema.parse(filters) : {};
    
    const where: Record<string, unknown> = {};
    
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