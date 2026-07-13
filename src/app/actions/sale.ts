"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentMethod, computePayment } from "@/lib/utils/payment";

// Schema para un item de venta
const saleItemSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
});

// Schema para registrar una venta con múltiples productos
const registerSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  customerId: z.number().int().positive().optional(),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  // MIXTO manual inputs
  cashAmount: z.number().min(0).optional(),
  transferAmount: z.number().min(0).optional(),
}).refine(
  (data) =>
    data.paymentMethod !== PaymentMethod.MIXTO ||
    ((data.cashAmount ?? 0) + (data.transferAmount ?? 0) > 0),
  {
    message: "MIXTO requiere cashAmount o transferAmount mayor a 0",
    path: ["cashAmount"],
  }
);

export async function registerSale(data: unknown) {
  try {
    const validatedData = registerSaleSchema.parse(data);

    // Paso 1: Verificar stock disponible ANTES de iniciar la transacción
    for (const item of validatedData.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return {
          success: false,
          error: `Producto con ID ${item.productId} no encontrado`,
        };
      }

      if (product.stock < item.quantity) {
        return {
          success: false,
          error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${item.quantity}`,
        };
      }
    }

    // Calcular el total
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    // Calcular payment allocation
    // If paymentMethod provided, use computePayment (overrides amountPaid)
    // Otherwise, use legacy amountPaid logic for backward compatibility
    let amountPaid: number;
    let pendingBalance: number;
    const paymentMethod = validatedData.paymentMethod ?? PaymentMethod.EFECTIVO;
    const customerId = validatedData.customerId;

    if (validatedData.paymentMethod) {
      // New logic: compute from payment method
      const paymentResult = computePayment(paymentMethod, totalAmount, {
        cash: validatedData.cashAmount,
        transfer: validatedData.transferAmount,
      });
      amountPaid = paymentResult.amountPaid;
      pendingBalance = paymentResult.pendingBalance;
    } else {
      // Legacy logic: backward compatibility
      amountPaid = validatedData.amountPaid || 0;
      pendingBalance = Math.max(0, totalAmount - amountPaid);
    }

    // Paso 2: Transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro de venta (cabecera)
      const sale = await tx.sale.create({
        data: {
          totalAmount,
          amountPaid,
          pendingBalance,
          paymentMethod,
          customerId: customerId || null,
        },
      });

      // 1.5. Si hay cliente y pending balance, incrementar su deuda
      if (customerId && pendingBalance > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalBalance: {
              increment: pendingBalance,
            },
          },
        });
      }

      // 2. Crear los items de venta
      const itemsData = validatedData.items.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      }));

      await tx.saleItem.createMany({
        data: itemsData,
      });

      // 3. Disminuir el stock de cada producto
      for (const item of validatedData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Obtener los items creados para retornar
      const createdItems = await tx.saleItem.findMany({
        where: { saleId: sale.id },
        include: { product: true },
      });

      return { sale, items: createdItems, totalAmount };
    });

    // Revalidate cache for ventas, inventario, and clientes pages
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/clientes");

    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error registering sale:", error);
    return { success: false, error: "Error al registrar la venta" };
  }
}

// Schema para obtener ventas
const getSalesSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function getSales(filters?: unknown) {
  try {
    const validatedFilters = filters ? getSalesSchema.parse(filters) : {};
    
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

    const sales = await prisma.sale.findMany({
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

    return { success: true, data: parseArray(sales) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching sales:", error);
    return { success: false, error: "Error al obtener las ventas" };
  }
}

export async function getSaleById(id: number) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    if (!sale) {
      return { success: false, error: "Venta no encontrada" };
    }
    
    return { success: true, data: parseObject(sale) };
  } catch (error) {
    console.error("Error fetching sale:", error);
    return { success: false, error: "Error al obtener la venta" };
  }
}