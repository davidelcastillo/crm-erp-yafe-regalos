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
 * Pisos del cierre de caja, con **una sola** lectura de los últimos cierres.
 *
 * Las ventas y las compras guardan el instante en `date`, así que se comparan
 * contra `closedAt` directo. La plata de caja no: su `date` es un **día
 * declarado** (medianoche), que no se puede comparar contra un instante. El corte
 * mide cuándo entró la plata a la caja, o sea `createdAt` (bug de producción del
 * 2026-10-23: un egreso cargado después del cierre con la fecha del día anterior
 * quedaba fuera del corte y del tablero).
 *
 * Se aplica solo en el período «desde el último cierre»: 7/30/90/personalizado
 * muestran todo lo que cae en el rango (pedido del usuario).
 */
export async function pisosDeCaja(branchId?: number) {
  const cierres = await ultimosCierres(branchId);

  if (cierres.length === 0) return { porFecha: {}, porCarga: {} };

  const conCierre = cierres.map((c) => c.branchId);
  const sinCierre = { branchId: { notIn: conCierre } };

  return {
    porFecha: {
      OR: [
        ...cierres.map((c) => ({ branchId: c.branchId, date: { gt: c.closedAt } })),
        sinCierre,
      ],
    },
    porCarga: {
      OR: [
        ...cierres.map((c) => ({ branchId: c.branchId, createdAt: { gt: c.closedAt } })),
        sinCierre,
      ],
    },
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
