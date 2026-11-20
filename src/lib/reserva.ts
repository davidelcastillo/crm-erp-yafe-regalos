// src/lib/reserva.ts
"use server";
/**
 * Reserva derivada (R1, `docs/adr/prendas-pedidos-diseno-logica.md` §2.2).
 *
 * Lo reservado **no se guarda**: es la suma de `PedidoItem.cantidad` de los
 * pedidos en estado `RESERVADO`. Así `stock` sigue siendo la realidad física
 * del estante y la reserva no es una segunda verdad que se pueda desincronizar.
 *
 * Consecuencia que sostiene este archivo: la venta directa y el traspaso tienen
 * que mirar `stock − reservado`, no `stock` a secas (I2). Y como el chequeo y la
 * escritura conviven en una transacción, ambos van bajo el mismo advisory lock
 * por (producto, sucursal) que usa el alta de pedido: sin él, dos transacciones
 * pueden reservar y vender la misma unidad a la vez.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/** Unidades que una operación quiere llevarse de un producto. */
export type ItemReserva = { productId: number; cantidad: number };

/**
 * Advisory lock de la fila de inventario (producto + sucursal) hasta el commit:
 * serializa la reserva con la venta y con el traspaso de la misma unidad.
 */
export async function bloquearStockInventario(
  tx: Prisma.TransactionClient,
  productId: number,
  branchId: number
): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${productId}, ${branchId})`);
}

/**
 * Lo reservado por pedidos `RESERVADO`, por producto. `branchId` acota a una
 * sucursal (lo que hace el alta de pedido) y `productIds` al producto que
 * interesa; sin filtros suma todo el sistema, que es lo que mira la ficha.
 */
export async function reservadoPorProducto(
  tx: Prisma.TransactionClient,
  filtro: { branchId?: number; productIds?: number[] } = {}
): Promise<Map<number, number>> {
  // Semántica del query original de pedido.ts: `in: []` no matcheaba nada. Sin
  // esta guarda, un llamador futuro con lista vacía se llevaría TODAS las
  // reservas de la sucursal (trampa latente anotada por el verificador de U6).
  if (filtro.productIds !== undefined && filtro.productIds.length === 0) {
    return new Map();
  }
  const filas = await tx.pedidoItem.groupBy({
    by: ["productId"],
    where: {
      ...(filtro.branchId === undefined ? {} : { branchId: filtro.branchId }),
      ...(filtro.productIds?.length ? { productId: { in: filtro.productIds } } : {}),
      pedido: { estado: "RESERVADO" },
    },
    _sum: { cantidad: true },
  });
  return new Map(filas.map((fila) => [fila.productId, fila._sum.cantidad ?? 0]));
}

/**
 * Chequeo R1 bajo lock: `stock − reservado ≥ cantidad` por producto, con las
 * cantidades repetidas del mismo producto sumadas. Lanza `Stock insuficiente …`
 * nombrando el producto y lo reservado, que es el formato que los callers ya
 * propagan al usuario.
 *
 * Sin reservas no opina: ahí manda el decremento condicional de siempre
 * (`stock >= cantidad`), así el mensaje de la venta normal no cambia.
 */
export async function verificarDisponible(
  tx: Prisma.TransactionClient,
  opciones: { branchId: number; items: ItemReserva[]; accion: string; lugar?: string }
): Promise<void> {
  const pedidoPorProducto = new Map<number, number>();
  for (const item of opciones.items) {
    pedidoPorProducto.set(
      item.productId,
      (pedidoPorProducto.get(item.productId) ?? 0) + item.cantidad
    );
  }
  const productIds = [...pedidoPorProducto.keys()].sort((a, b) => a - b);
  for (const productId of productIds) {
    await bloquearStockInventario(tx, productId, opciones.branchId);
  }

  const reservado = await reservadoPorProducto(tx, {
    branchId: opciones.branchId,
    productIds,
  });
  const conReserva = productIds.filter((productId) => (reservado.get(productId) ?? 0) > 0);
  if (conReserva.length === 0) return;

  const [inventario, productos] = await Promise.all([
    tx.branchInventory.findMany({
      where: { branchId: opciones.branchId, productId: { in: conReserva } },
      select: { productId: true, stock: true },
    }),
    tx.product.findMany({ where: { id: { in: conReserva } }, select: { id: true, name: true } }),
  ]);
  const stockPorProducto = new Map(inventario.map((fila) => [fila.productId, fila.stock]));

  for (const productId of conReserva) {
    const cantidad = pedidoPorProducto.get(productId) ?? 0;
    const tomado = reservado.get(productId) ?? 0;
    const disponible = (stockPorProducto.get(productId) ?? 0) - tomado;
    if (disponible >= cantidad) continue;

    const nombre = productos.find((producto) => producto.id === productId)?.name ?? productId;
    throw new Error(
      `Stock insuficiente${opciones.lugar ?? ""} para "${nombre}": reservado ${tomado} por pedidos, disponible ${disponible}, ${opciones.accion} pide ${cantidad}`
    );
  }
}

const disponibilidadSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
});

/**
 * Disponibilidad derivada de una prenda (ADR §1.3): no se guarda un estado, se
 * calcula. `vendida` es stock total 0 **y** al menos una venta; una baja por
 * ajuste o pérdida no es «Vendida».
 */
export async function disponibilidadPrenda(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { productId } = disponibilidadSchema.parse(data);

    const [inventario, reservado, ventas] = await Promise.all([
      prisma.branchInventory.aggregate({ where: { productId }, _sum: { stock: true } }),
      reservadoPorProducto(prisma, { productIds: [productId] }),
      prisma.saleItem.count({ where: { productId } }),
    ]);

    const stock = inventario._sum.stock ?? 0;
    const tomado = reservado.get(productId) ?? 0;

    return {
      success: true as const,
      data: { disponible: stock - tomado, reservado: tomado, vendida: stock === 0 && ventas > 0 },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues.map((i) => i.message).join(", ") };
    }
    console.error("Error al calcular la disponibilidad de la prenda:", error);
    return { success: false as const, error: "Error al calcular la disponibilidad de la prenda" };
  }
}
