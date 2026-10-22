import { prisma } from "@/lib/prisma";

/**
 * Historial de movimientos de un producto: documentos (compra y venta) y
 * movimientos del libro de sucursal (entradas, salidas, transferencias y
 * ajustes).
 *
 * Lo comparten el modal interno de `/inventario` (un producto) y el catálogo
 * público de la sucursal (todos los productos de la sucursal), así las dos
 * vistas no pueden divergir en qué cuenta como movimiento.
 */

export type ProductMovementType =
  | "PURCHASE"
  | "SALE"
  | "ENTRY"
  | "EXIT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT";

export type ProductMovementRow = {
  productId: number;
  productCode: string;
  id: string;
  type: ProductMovementType;
  /** ISO 8601. */
  date: string;
  quantity: number;
  /** Id del documento cuando el movimiento viene de una compra o una venta. */
  referenceId: number | null;
  /** Referencia del libro de sucursal (ej. "MOVE-…", "CONTROL-…", "ADJUSTMENT"). */
  reference: string | null;
  branchName: string | null;
};

/**
 * @param since desde cuándo mirar (creación del producto o último control).
 * @param branchId `null` = todas las sucursales.
 * @param productIds `undefined` = todos los productos; una lista, solo esos.
 */
export async function readProductMovements(options: {
  since: Date;
  branchId?: number | null;
  productIds?: number[];
}): Promise<ProductMovementRow[]> {
  const { since, branchId = null, productIds } = options;
  const productFilter = productIds ? { productId: { in: productIds } } : {};
  const branchFilter = branchId !== null ? { branchId } : {};

  const [purchaseItems, saleItems, branchMovements] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: { ...productFilter, purchase: { date: { gte: since }, ...branchFilter } },
      select: {
        id: true,
        productId: true,
        quantity: true,
        product: { select: { code: true } },
        purchase: {
          select: { id: true, date: true, branch: { select: { name: true } } },
        },
      },
    }),
    prisma.saleItem.findMany({
      where: { ...productFilter, sale: { date: { gte: since }, ...branchFilter } },
      select: {
        id: true,
        productId: true,
        quantity: true,
        product: { select: { code: true } },
        sale: { select: { id: true, date: true, branch: { select: { name: true } } } },
      },
    }),
    // La ENTRY de una compra y la EXIT de una venta ya son una fila del
    // historial: sin estos filtros la misma operación aparecería dos veces.
    prisma.branchMovement.findMany({
      where: {
        ...productFilter,
        createdAt: { gte: since },
        ...branchFilter,
        NOT: [
          { movementType: "ENTRY", reference: { startsWith: "PURCHASE-" } },
          { movementType: "EXIT", reference: { startsWith: "SALE-" } },
        ],
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        movementType: true,
        reference: true,
        createdAt: true,
        product: { select: { code: true } },
        branch: { select: { name: true } },
      },
    }),
  ]);

  const rows: ProductMovementRow[] = [
    ...purchaseItems.map((item) => ({
      productId: item.productId,
      productCode: item.product.code,
      id: `purchase-${item.id}`,
      type: "PURCHASE" as const,
      date: item.purchase.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.purchase.id,
      reference: null,
      branchName: item.purchase.branch?.name ?? null,
    })),
    ...saleItems.map((item) => ({
      productId: item.productId,
      productCode: item.product.code,
      id: `sale-${item.id}`,
      type: "SALE" as const,
      date: item.sale.date.toISOString(),
      quantity: item.quantity,
      referenceId: item.sale.id,
      reference: null,
      branchName: item.sale.branch?.name ?? null,
    })),
    ...branchMovements.map((movement) => ({
      productId: movement.productId,
      productCode: movement.product.code,
      id: `movement-${movement.id}`,
      type: movement.movementType as ProductMovementType,
      date: movement.createdAt.toISOString(),
      quantity: movement.quantity,
      referenceId: null,
      reference: movement.reference,
      branchName: movement.branch?.name ?? null,
    })),
  ];

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
