import { prisma } from "@/lib/prisma";

/**
 * Piso del cierre de caja para los indicadores (S17 del usuario: el cierre
 * **resetea los indicadores**): una venta o un movimiento de plata anterior al
 * **último cierre de su sucursal** pertenece a la caja cerrada, así que deja de
 * contar. Se devuelve como filtro para poder combinarlo con el período y la
 * sucursal elegidos (`AND` de Prisma).
 *
 * Sin sucursal elegida el piso se arma con el último cierre de **cada** sucursal;
 * las que nunca cerraron caja no tienen piso.
 */
export async function pisoDeCaja(branchId?: number) {
  const cierres = await prisma.cashClose.findMany({
    distinct: ["branchId"],
    orderBy: { closedAt: "desc" },
    select: { branchId: true, closedAt: true },
    ...(branchId ? { where: { branchId } } : {}),
  });

  if (cierres.length === 0) return {};

  const conCierre = cierres.map((c) => c.branchId);
  return {
    OR: [
      ...cierres.map((c) => ({ branchId: c.branchId, date: { gt: c.closedAt } })),
      { branchId: { notIn: conCierre } },
    ],
  };
}
