// src/app/actions/sale.ts
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
// branchId es obligatorio: el inventario se descuenta de esa sucursal
const registerSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  branchId: z.coerce.number().int().positive("La sucursal es requerida"),
  customerId: z.number().int().positive().optional(),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  // MIXTO manual inputs
  cashAmount: z.number().min(0).optional(),
  transferAmount: z.number().min(0).optional(),
  // Actor del libro de la sucursal (audit trail del movimiento EXIT).
  performedBy: z.string().min(1).max(100).optional(),
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

    // Verify the branch exists and is active before processing
    const branch = await prisma.branch.findFirst({
      where: { id: validatedData.branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { success: false, error: "Sucursal inválida o inactiva" };
    }

    // Verify products exist (outside transaction, safe)
    for (const item of validatedData.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true },
      });
      if (!product) {
        return {
          success: false,
          error: `Producto con ID ${item.productId} no encontrado`,
        };
      }
    }

    // Calcular el total
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
    const { performedBy } = validatedData;

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

    // Paso: Transacción atómica con decremento condicional de stock
    const result = await prisma.$transaction(async (tx) => {
      // 0. Validar y descontar stock ANTES de crear la cabecera (fail fast).
      //    El updateMany condicional evita TOCTOU: solo descuenta si hay stock suficiente.
      for (const item of validatedData.items) {
        const updateResult = await tx.branchInventory.updateMany({
          where: {
            branchId: validatedData.branchId,
            productId: item.productId,
            stock: { gte: item.quantity }, // only if sufficient stock
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updateResult.count === 0) {
          // Either no inventory row or stock < quantity
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true },
          });
          throw new Error(
            `Stock insuficiente para "${product?.name ?? item.productId}" en la sucursal seleccionada. Disponible: 0 o menos que solicitado.`
          );
        }
      }

      // 1. Crear el registro de venta (cabecera) con branchId
      const sale = await tx.sale.create({
        data: {
          totalAmount,
          amountPaid,
          pendingBalance,
          paymentMethod,
          customerId: customerId || null,
          branchId: validatedData.branchId,
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

      // 2.5. Libro de la sucursal: la venta saca stock de esa sucursal. Antes solo
      //      bajaba BranchInventory, así que el historial del producto y la
      //      auditoría de stock no veían la venta (hallazgo de T10.1).
      if (performedBy) {
        await tx.branchMovement.createMany({
          data: validatedData.items.map((item) => ({
            productId: item.productId,
            branchId: validatedData.branchId,
            movementType: "EXIT",
            quantity: item.quantity,
            reference: `SALE-${sale.id}`,
            performedBy,
          })),
        });
      }

      // 3. Obtener los items creados para retornar
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
    // Preserve business-logic error messages (e.g. insufficient stock)
    if (error instanceof Error && error.message.includes("Stock insuficiente")) {
      return { success: false, error: error.message };
    }
    console.error("Error registering sale:", error);
    return { success: false, error: "Error al registrar la venta" };
  }
}

// Schema para obtener ventas (opcionalmente filtradas por branch, fecha,
// búsqueda de producto y paginación)
const getSalesSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
});

export async function getSales(filters?: unknown) {
  try {
    const validatedFilters = filters ? getSalesSchema.parse(filters) : {};
    
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

    if (validatedFilters.search) {
      where.items = {
        some: {
          OR: [
            { product: { name: { contains: validatedFilters.search, mode: "insensitive" } } },
            { product: { code: { contains: validatedFilters.search, mode: "insensitive" } } },
          ],
        },
      };
    }

    const include = {
      items: {
        include: {
          product: true,
        },
      },
      branch: {
        select: { id: true, name: true },
      },
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include,
        orderBy: { date: "desc" },
        take: validatedFilters.take ?? 20,
        skip: validatedFilters.skip ?? 0,
      }),
      prisma.sale.count({ where }),
    ]);

    // Las ventas anteriores al último cierre de su sucursal son de la caja
    // anterior (S17): el listado las muestra oscurecidas y las nuevas en blanco.
    const cierres = await prisma.cashClose.findMany({
      distinct: ["branchId"],
      orderBy: { closedAt: "desc" },
      select: { branchId: true, closedAt: true },
    });
    const ultimoCierre = new Map(cierres.map((c) => [c.branchId, c.closedAt]));

    const items = parseArray(
      sales.map((sale) => ({
        ...sale,
        previousCash: (ultimoCierre.get(sale.branchId)?.getTime() ?? 0) >= sale.date.getTime(),
      }))
    );

    return { success: true, data: { items, total } };
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
          }
        }
      }
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