// src/app/actions/sale.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentMethod, computePayment } from "@/lib/utils/payment";
import { registrarVentaTx } from "@/lib/sale-registration";
import { verificarDisponible } from "@/lib/reserva";

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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

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

    // Paso: Transacción atómica. El cuerpo vive en `sale-registration` porque
    // `cobrarPedido` registra la misma venta desde su propia transacción.
    const result = await prisma.$transaction(async (tx) => {
      // R1: el mostrador no puede llevarse unidades que un pedido RESERVADO
      // tiene tomadas. Va acá y no en el helper de la venta porque el lock y el
      // chequeo tienen que compartir transacción con el descuento, y porque el
      // cobro de un pedido ya valida su propia reserva antes de llegar acá.
      await verificarDisponible(tx, {
        branchId: validatedData.branchId,
        items: validatedData.items.map((item) => ({
          productId: item.productId,
          cantidad: item.quantity,
        })),
        accion: "la venta",
      });

      return registrarVentaTx(tx, {
        branchId: validatedData.branchId,
        items: validatedData.items,
        paymentMethod,
        totalAmount,
        amountPaid,
        pendingBalance,
        customerId: customerId || null,
        performedBy,
      });
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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

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