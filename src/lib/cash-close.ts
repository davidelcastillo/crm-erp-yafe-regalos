import { prisma } from "@/lib/prisma";
import { finDelDia, toLocalDateKey } from "@/lib/dates";

/** Último cierre de cada sucursal (o el de una sola, si se pasa el id). */
export async function ultimosCierres(branchId?: number) {
  return prisma.cashClose.findMany({
    distinct: ["branchId"],
    orderBy: { closedAt: "desc" },
    select: { branchId: true, closedAt: true },
    ...(branchId ? { where: { branchId } } : {}),
  });
}

/**
 * Piso del cierre de caja: una venta o un movimiento de plata anterior al
 * **último cierre de su sucursal** pertenece a la caja cerrada. Se aplica solo
 * en el período «desde el último cierre»: 7/30/90/personalizado muestran todo lo
 * que cae en el rango (pedido del usuario).
 *
 * Se devuelve como filtro para poder combinarlo con la sucursal elegida (`AND` de
 * Prisma). Sin sucursal, el piso se arma con el último cierre de **cada**
 * sucursal; las que nunca cerraron caja no tienen piso.
 */
export async function pisoDeCaja(branchId?: number) {
  const cierres = await ultimosCierres(branchId);

  if (cierres.length === 0) return {};

  const conCierre = cierres.map((c) => c.branchId);
  return {
    OR: [
      ...cierres.map((c) => ({ branchId: c.branchId, date: { gt: c.closedAt } })),
      { branchId: { notIn: conCierre } },
    ],
  };
}

/**
 * Rango del período «desde el último cierre de caja»: desde el cierre más viejo
 * relevante hasta el final del día de hoy. Sin ningún cierre se comporta como
 * los últimos 30 días, para no quedar sin datos el primer día.
 */
export async function rangoDelUltimoCierre(branchId?: number) {
  const cierres = await ultimosCierres(branchId);
  const hasta = finDelDia(toLocalDateKey(new Date()));

  if (cierres.length === 0) {
    const primerDia = new Date();
    primerDia.setDate(primerDia.getDate() - 29);
    return { desde: new Date(`${toLocalDateKey(primerDia)}T00:00:00`), hasta };
  }

  const desde = cierres.reduce(
    (masViejo, cierre) => (cierre.closedAt < masViejo ? cierre.closedAt : masViejo),
    cierres[0].closedAt
  );

  return { desde, hasta };
}
