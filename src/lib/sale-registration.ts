// src/lib/sale-registration.ts
/**
 * Núcleo de escritura de una venta, extraído del cuerpo de la transacción de
 * `registerSale` (U4) para que `cobrarPedido` registre exactamente la misma
 * venta dentro de su propia transacción: descuento condicional de stock,
 * cabecera, ítems, deuda del cliente si queda saldo y movimiento `EXIT` de la
 * sucursal.
 *
 * El refactor no cambia lo que `registerSale` hacía: los importes siguen
 * llegando ya calculados por el llamador (que es quien decide los medios de
 * pago), y los ítems se escriben tal como vienen.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/lib/utils/payment";

export type ItemVentaTx = {
  productId: number;
  /** Precio unitario ya decidido por el servidor. */
  price: Prisma.Decimal.Value;
  quantity: number;
};

export type VentaTxInput = {
  branchId: number;
  items: ItemVentaTx[];
  paymentMethod: PaymentMethod;
  /** Lo que cobra la venta; el saldo lo calcula el llamador. */
  totalAmount: Prisma.Decimal.Value;
  amountPaid: Prisma.Decimal.Value;
  pendingBalance: Prisma.Decimal.Value;
  /** Actor del libro de la sucursal: sin actor no se escribe el `EXIT`. */
  performedBy?: string;
  customerId?: number | null;
  /** Se antepone a la referencia `SALE-<id>` del movimiento (ej. `PEDIDO-V-0001`). */
  reference?: string;
};

export async function registrarVentaTx(tx: Prisma.TransactionClient, venta: VentaTxInput) {
  const { branchId, items, paymentMethod, performedBy, customerId, reference } = venta;

  // 0. Validar y descontar stock ANTES de crear la cabecera (fail fast).
  //    El updateMany condicional evita TOCTOU: solo descuenta si hay stock suficiente.
  for (const item of items) {
    const updateResult = await tx.branchInventory.updateMany({
      where: {
        branchId,
        productId: item.productId,
        stock: { gte: item.quantity },
      },
      data: { stock: { decrement: item.quantity } },
    });

    if (updateResult.count === 0) {
      // Either no inventory row or stock < quantity. El nombre se lee por fuera
      // de la transacción: es el mismo camino que tenía `registerSale`.
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      throw new Error(
        `Stock insuficiente para "${product?.name ?? item.productId}" en la sucursal seleccionada. Disponible: 0 o menos que solicitado.`
      );
    }
  }

  // 1. Cabecera de la venta.
  const sale = await tx.sale.create({
    data: {
      totalAmount: venta.totalAmount,
      amountPaid: venta.amountPaid,
      pendingBalance: venta.pendingBalance,
      paymentMethod,
      customerId: customerId || null,
      branchId,
    },
  });

  // 2. Si hay cliente y saldo, la deuda del cliente sube con la venta.
  if (customerId && new Prisma.Decimal(venta.pendingBalance).gt(0)) {
    await tx.customer.update({
      where: { id: customerId },
      data: { totalBalance: { increment: venta.pendingBalance } },
    });
  }

  // 3. Ítems de la venta.
  await tx.saleItem.createMany({
    data: items.map((item) => ({
      saleId: sale.id,
      productId: item.productId,
      price: item.price,
      quantity: item.quantity,
      subtotal: new Prisma.Decimal(item.price).mul(item.quantity),
    })),
  });

  // 4. Libro de la sucursal: la venta saca stock de esa sucursal.
  if (performedBy) {
    await tx.branchMovement.createMany({
      data: items.map((item) => ({
        productId: item.productId,
        branchId,
        movementType: "EXIT" as const,
        quantity: item.quantity,
        reference: reference ? `${reference} SALE-${sale.id}` : `SALE-${sale.id}`,
        performedBy,
      })),
    });
  }

  const createdItems = await tx.saleItem.findMany({
    where: { saleId: sale.id },
    include: { product: true },
  });

  return { sale, items: createdItems, totalAmount: venta.totalAmount };
}
