"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { finDelDia, inicioDelDia, toLocalDateKey } from "@/lib/dates";
import { z } from "zod";

/**
 * Consultas de `/reportes` (pantalla «solo la dueña»: acá sí entran costos).
 *
 * Las ventas se reparten entre los estilos de cada producto: un `SaleItem` con 2
 * estilos aporta la mitad de su monto y de sus unidades a cada uno, y así la
 * suma de los estilos sigue dando el total vendido. El prorrateo hace que la
 * columna «unidades» pueda quedar fraccionaria, y es a propósito: el estilo no
 * se registra en la venta, solo se conoce por los puentes del producto.
 */

const dosDecimales = (n: number) => Math.round(n * 100) / 100;

const reportesSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

// Lunes de la semana local de una fecha (clave "YYYY-MM-DD").
const semanaDe = (fecha: Date) => {
  const lunes = new Date(fecha);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return toLocalDateKey(lunes);
};

type ConEstilos = {
  prenda: { estilos: { estilo: { name: string } }[] } | null;
  estilosProducto: { estilo: { name: string } }[];
};

// Un producto es PRENDA (estilos en la ficha) o PRODUCT (en su puente); la unión
// cubre los dos casos sin mirar `kind`.
const estilosDe = (producto: ConEstilos) =>
  [...(producto.prenda?.estilos ?? []), ...producto.estilosProducto].map(
    (fila) => fila.estilo.name
  );

type Acumulado = { total: number; unidades: number };

const acumular = (mapa: Map<string, Acumulado>, clave: string, total: number, unidades: number) => {
  const fila = mapa.get(clave) ?? { total: 0, unidades: 0 };
  fila.total += total;
  fila.unidades += unidades;
  mapa.set(clave, fila);
};

const filasDe = (mapa: Map<string, Acumulado>, nombre: string) =>
  [...mapa.entries()]
    .map(([clave, fila]) => ({
      [nombre]: clave,
      total: dosDecimales(fila.total),
      unidades: dosDecimales(fila.unidades),
    }))
    .sort((a, b) => b.total - a.total);

export async function getReportes(data?: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = reportesSchema.parse(data ?? {});
    if (!parsed.desde || !parsed.hasta) {
      return {
        success: false as const,
        error: "Seleccioná un rango de fechas para los reportes",
      };
    }

    const desde = inicioDelDia(parsed.desde);
    const hasta = finDelDia(parsed.hasta);
    if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || desde > hasta) {
      return { success: false as const, error: "Rango de fechas inválido" };
    }

    const branchWhere = parsed.branchId ? { branchId: parsed.branchId } : {};

    const [items, stock] = await Promise.all([
      prisma.saleItem.findMany({
        where: { sale: { date: { gte: desde, lte: hasta }, ...branchWhere } },
        select: {
          saleId: true,
          quantity: true,
          subtotal: true,
          sale: {
            select: {
              date: true,
              customerId: true,
              customer: { select: { name: true, surname: true } },
            },
          },
          product: {
            select: {
              category: { select: { name: true } },
              prenda: {
                select: {
                  costo: true,
                  categoria: { select: { name: true } },
                  estilos: { select: { estilo: { select: { name: true } } } },
                },
              },
              estilosProducto: { select: { estilo: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.branchInventory.findMany({
        where: { stock: { gt: 0 }, ...branchWhere },
        select: {
          stock: true,
          product: {
            select: {
              prenda: {
                select: { estilos: { select: { estilo: { select: { name: true } } } } },
              },
              estilosProducto: { select: { estilo: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    let ingresos = 0;
    let unidades = 0;
    let costo = 0;
    let itemsSinCosto = 0;
    const ventas = new Set<number>();
    const porSemana = new Map<string, Acumulado>();
    const porCategoria = new Map<string, Acumulado>();
    const porEstilo = new Map<string, Acumulado>();
    const porClienta = new Map<
      number,
      { cliente: string; compras: Set<number>; total: number; ultima: Date }
    >();

    for (const item of items) {
      const monto = Number(item.subtotal);
      ingresos += monto;
      unidades += item.quantity;
      ventas.add(item.saleId);

      // Sin ficha de prenda no hay costo conocido: cuenta 0 y se informa.
      if (item.product.prenda) {
        costo += Number(item.product.prenda.costo) * item.quantity;
      } else {
        itemsSinCosto += 1;
      }

      acumular(porSemana, semanaDe(item.sale.date), monto, item.quantity);

      const categoria =
        item.product.prenda?.categoria.name ?? item.product.category?.name ?? "Sin categoría";
      acumular(porCategoria, categoria, monto, item.quantity);

      // Prorrateo en partes iguales entre los estilos del producto.
      const estilos = estilosDe(item.product);
      const partes = estilos.length || 1;
      for (const estilo of estilos.length ? estilos : ["Sin estilo"]) {
        acumular(porEstilo, estilo, monto / partes, item.quantity / partes);
      }

      const cliente = item.sale.customer;
      if (cliente && item.sale.customerId !== null) {
        const fila = porClienta.get(item.sale.customerId) ?? {
          cliente: `${cliente.name} ${cliente.surname}`.trim(),
          compras: new Set<number>(),
          total: 0,
          ultima: item.sale.date,
        };
        fila.compras.add(item.saleId);
        fila.total += monto;
        if (item.sale.date > fila.ultima) fila.ultima = item.sale.date;
        porClienta.set(item.sale.customerId, fila);
      }
    }

    // El stock se reparte con el mismo criterio que las ventas: es del producto,
    // no del estilo, así que cada estilo del producto recibe su parte.
    const stockPorEstilo = new Map<string, number>();
    for (const fila of stock) {
      const estilos = estilosDe(fila.product);
      const partes = estilos.length || 1;
      for (const estilo of estilos.length ? estilos : ["Sin estilo"]) {
        stockPorEstilo.set(estilo, (stockPorEstilo.get(estilo) ?? 0) + fila.stock / partes);
      }
    }

    const ganancia = ingresos - costo;
    const topClientas = [...porClienta.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((fila) => ({
        cliente: fila.cliente,
        compras: fila.compras.size,
        total: dosDecimales(fila.total),
        ultimaCompra: toLocalDateKey(fila.ultima),
      }));

    return {
      success: true as const,
      data: {
        kpis: {
          ingresos: dosDecimales(ingresos),
          unidades,
          ventas: ventas.size,
          costo: dosDecimales(costo),
          itemsSinCosto,
          ganancia: dosDecimales(ganancia),
          margen: ingresos > 0 ? dosDecimales((ganancia / ingresos) * 100) : 0,
          ticketPromedio: ventas.size > 0 ? dosDecimales(ingresos / ventas.size) : 0,
        },
        semanas: [...porSemana.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([semana, fila]) => ({
            semana,
            total: dosDecimales(fila.total),
            unidades: dosDecimales(fila.unidades),
          })),
        categorias: filasDe(porCategoria, "categoria"),
        estilos: filasDe(porEstilo, "estilo"),
        stockPorEstilo: [...stockPorEstilo.entries()]
          .map(([estilo, valor]) => ({ estilo, stock: dosDecimales(valor) }))
          .sort((a, b) => b.stock - a.stock),
        topClientas,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: "Parámetros de reportes inválidos" };
    }
    console.error("Error al obtener los reportes:", error);
    return { success: false as const, error: "Error al obtener los reportes" };
  }
}
