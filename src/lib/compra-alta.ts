// src/lib/compra-alta.ts
import type { Prisma } from "@prisma/client";

/**
 * S2 (odd/tasks/talles-y-compra-alta.md): registra la compra del alta dentro
 * de la MISMA transacción, **sin tocar stock** — el alta ya ingresa su stock
 * con su propio movimiento `ENTRY`. Reusar `registerPurchase` contaría el
 * stock dos veces, así que este helper solo escribe `Purchase` +
 * `PurchaseItem` y aparece en `/compras` como cualquier compra.
 */
export async function registrarCompraDelAlta(
  tx: Prisma.TransactionClient,
  branchId: number,
  items: Array<{ productId: number; price: number; quantity: number }>
): Promise<void> {
  if (items.length === 0) return;

  const totalAmount = items.reduce((suma, item) => suma + item.price * item.quantity, 0);
  const purchase = await tx.purchase.create({ data: { totalAmount, branchId } });

  await tx.purchaseItem.createMany({
    data: items.map((item) => ({
      purchaseId: purchase.id,
      productId: item.productId,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    })),
  });
}
