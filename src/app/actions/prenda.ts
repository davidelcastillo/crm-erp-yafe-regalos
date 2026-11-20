// src/app/actions/prenda.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNextCode, prefixLockKey } from "@/lib/utils/product-code";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import {
  createPrendaSchema,
  updatePrendaSchema,
  type PrendaEditable,
} from "@/lib/validations/prenda";

/** Motivo del ingreso inicial en el movimiento y en el comprobante. */
const PRENDA_ENTRY_REFERENCE = "ALTA DE PRENDA";

const zodMessage = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(", ");

/**
 * Verifica que las taxonomías elegidas existan y estén activas. Una fila
 * desactivada no se puede elegir de nuevo: se conserva en las prendas que ya la
 * tenían, pero no entra en un alta ni en una edición.
 */
async function taxonomiasInactivas(datos: {
  categoriaPrendaId: number;
  condicionId: number;
  estilos: number[];
  medidas: Array<{ medidaTipoId: number }>;
}): Promise<string | null> {
  const medidaTipoIds = [...new Set(datos.medidas.map((medida) => medida.medidaTipoId))];
  const [categoria, condicion, estilos, medidas] = await Promise.all([
    prisma.categoriaPrenda.findFirst({
      where: { id: datos.categoriaPrendaId, active: true },
      select: { id: true },
    }),
    prisma.condicionPrenda.findFirst({
      where: { id: datos.condicionId, active: true },
      select: { id: true },
    }),
    datos.estilos.length === 0
      ? []
      : prisma.estiloPrenda.findMany({
          where: { id: { in: datos.estilos }, active: true },
          select: { id: true },
        }),
    medidaTipoIds.length === 0
      ? []
      : prisma.medidaTipo.findMany({
          where: { id: { in: medidaTipoIds }, active: true },
          select: { id: true },
        }),
  ]);

  if (!categoria) return "Categoría de prenda inválida o inactiva";
  if (!condicion) return "Condición inválida o inactiva";
  if (estilos.length !== datos.estilos.length) {
    return "Un estilo seleccionado no existe o está inactivo";
  }
  if (medidas.length !== medidaTipoIds.length) {
    return "Un tipo de medida no existe o está inactivo";
  }
  return null;
}

/**
 * Alta de prenda: `Product(kind=PRENDA)` + ficha + estilos/medidas/
 * publicaciones + la fila de inventario de la sucursal elegida, todo en una
 * transacción. El código (`RP…`/`RPI…`/`RPH…`) lo genera el servidor a partir del
 * prefijo de SU categoría, bajo el lock de ese prefijo; nunca lo manda el
 * cliente. El ingreso deja su movimiento `ENTRY` y el comprobante que consume
 * el panel del alta masiva.
 */
export async function createPrenda(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = createPrendaSchema.parse(data);

    const branch = await prisma.branch.findFirst({
      where: { id: parsed.branchId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    if (!branch) return { success: false as const, error: "Sucursal inválida o inactiva" };

    // U8: el prefijo del código viene de la categoría elegida (RP/RPI/RPH…),
    // inmune a la entrada del cliente. Se lee antes de la transacción: el
    // renombrado nunca lo toca, así que no puede cambiar bajo el lock.
    const categoria = await prisma.categoriaPrenda.findFirst({
      where: { id: parsed.categoriaPrendaId, active: true },
      select: { id: true, name: true, codePrefix: true },
    });
    if (!categoria) {
      return { success: false as const, error: "Categoría de prenda inválida o inactiva" };
    }
    if (!categoria.codePrefix) {
      return {
        success: false as const,
        error: `La categoría «${categoria.name}» no tiene prefijo de código`,
      };
    }
    const prefijo = categoria.codePrefix;

    const invalida = await taxonomiasInactivas(parsed);
    if (invalida) return { success: false as const, error: invalida };

    const resultado = await prisma.$transaction(async (tx) => {
      // Mismo lock y misma clave que el alta de productos del mismo prefijo.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${prefixLockKey(prefijo)})`);

      const existentes = await tx.product.findMany({
        where: { codePrefix: prefijo },
        select: { code: true },
      });
      const code = getNextCode(
        prefijo,
        existentes.map((producto) => producto.code).filter((c): c is string => c !== null)
      );

      const product = await tx.product.create({
        data: {
          name: parsed.nombre,
          description: parsed.descripcion || "-",
          price: parsed.precio,
          code,
          codePrefix: prefijo,
          kind: "PRENDA",
        },
        select: { id: true, code: true, name: true, price: true },
      });

      await tx.prendaDetalle.create({
        data: {
          productId: product.id,
          esUnica: parsed.esUnica,
          categoriaId: parsed.categoriaPrendaId,
          condicionId: parsed.condicionId,
          talle: parsed.talle,
          detalleCondicion: parsed.detalleCondicion ?? null,
          detalleIntervencion: parsed.detalleIntervencion ?? null,
          costo: parsed.costo,
        },
      });

      if (parsed.estilos.length > 0) {
        await tx.prendaEstilo.createMany({
          data: parsed.estilos.map((estiloId) => ({ productId: product.id, estiloId })),
        });
      }
      if (parsed.medidas.length > 0) {
        await tx.prendaMedida.createMany({
          data: parsed.medidas.map((medida) => ({
            productId: product.id,
            medidaTipoId: medida.medidaTipoId,
            valorCm: medida.valorCm,
          })),
        });
      }
      if (parsed.publicadaEn.length > 0) {
        await tx.prendaPublicacion.createMany({
          data: parsed.publicadaEn.map((canal) => ({ productId: product.id, canal })),
        });
      }

      const inventario = await tx.branchInventory.create({
        data: { branchId: branch.id, productId: product.id, stock: parsed.cantidad },
        select: { stock: true },
      });

      // La cantidad siempre es ≥ 1, así que el alta deja siempre su ingreso.
      await tx.branchMovement.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          movementType: "ENTRY",
          quantity: parsed.cantidad,
          reference: PRENDA_ENTRY_REFERENCE,
          // `performedBy` es obligatorio: sin email queda un responsable explícito.
          performedBy: auth.email || "sistema",
        },
      });

      const receipt: StockMovementReceipt = {
        movementType: "ENTRY",
        branchId: branch.id,
        date: new Date().toISOString(),
        branchName: branch.name,
        branchCode: branch.code,
        reference: PRENDA_ENTRY_REFERENCE,
        rows: [
          {
            productId: product.id,
            code: product.code,
            name: product.name,
            price: Number(product.price),
            quantity: parsed.cantidad,
            // Saldo confirmado por la transacción, no supuesto.
            stock: inventario.stock,
          },
        ],
      };

      return {
        product: {
          id: product.id,
          code: product.code,
          name: product.name,
          price: Number(product.price),
        },
        receipt,
      };
    });

    revalidatePath("/inventario");
    return { success: true as const, data: resultado };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof Error && error.message.includes("agotado")) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al crear la prenda:", error);
    return { success: false as const, error: "Error al crear la prenda" };
  }
}

/**
 * Edición de la prenda: producto y ficha, con estilos/medidas/publicaciones
 * reemplazados enteros dentro de la transacción. Nunca toca stock, inventario
 * ni movimientos (S20). `esUnica` no puede pasar a `true` si el stock total ya
 * supera 1: una prenda única no puede tener dos unidades (I1).
 */
export async function updatePrenda(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = updatePrendaSchema.parse(data);

    const actual = await prisma.product.findUnique({
      where: { id: parsed.id },
      select: {
        kind: true,
        prenda: { select: { esUnica: true } },
        inventory: { select: { stock: true } },
      },
    });
    if (!actual || actual.kind !== "PRENDA" || !actual.prenda) {
      return { success: false as const, error: "Prenda no encontrada" };
    }

    const invalida = await taxonomiasInactivas(parsed);
    if (invalida) return { success: false as const, error: invalida };

    const stockTotal = actual.inventory.reduce((total, fila) => total + fila.stock, 0);
    if (parsed.esUnica && !actual.prenda.esUnica && stockTotal > 1) {
      return {
        success: false as const,
        error: "No se puede marcar como única: la prenda tiene más de una unidad en stock",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: parsed.id },
        // `code`/`codePrefix` son inmutables y el stock vive en el inventario.
        data: {
          name: parsed.nombre,
          description: parsed.descripcion || "-",
          price: parsed.precio,
        },
      });

      await tx.prendaDetalle.update({
        where: { productId: parsed.id },
        data: {
          categoriaId: parsed.categoriaPrendaId,
          condicionId: parsed.condicionId,
          talle: parsed.talle,
          detalleCondicion: parsed.detalleCondicion ?? null,
          detalleIntervencion: parsed.detalleIntervencion ?? null,
          costo: parsed.costo,
          esUnica: parsed.esUnica,
        },
      });

      // Reemplazo entero de las filas hijas: borrar y volver a crear lo elegido.
      await tx.prendaEstilo.deleteMany({ where: { productId: parsed.id } });
      if (parsed.estilos.length > 0) {
        await tx.prendaEstilo.createMany({
          data: parsed.estilos.map((estiloId) => ({ productId: parsed.id, estiloId })),
        });
      }

      await tx.prendaMedida.deleteMany({ where: { productId: parsed.id } });
      if (parsed.medidas.length > 0) {
        await tx.prendaMedida.createMany({
          data: parsed.medidas.map((medida) => ({
            productId: parsed.id,
            medidaTipoId: medida.medidaTipoId,
            valorCm: medida.valorCm,
          })),
        });
      }

      await tx.prendaPublicacion.deleteMany({ where: { productId: parsed.id } });
      if (parsed.publicadaEn.length > 0) {
        await tx.prendaPublicacion.createMany({
          data: parsed.publicadaEn.map((canal) => ({ productId: parsed.id, canal })),
        });
      }
    });

    revalidatePath("/inventario");
    return { success: true as const, data: { id: parsed.id } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al actualizar la prenda:", error);
    return { success: false as const, error: "Error al actualizar la prenda" };
  }
}

/** Ficha editable de una prenda: con esto el formulario se abre en modo edición. */
export async function getPrenda(id: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        kind: true,
        prenda: {
          select: {
            esUnica: true,
            categoriaId: true,
            condicionId: true,
            talle: true,
            detalleCondicion: true,
            detalleIntervencion: true,
            costo: true,
            estilos: { select: { estiloId: true } },
            medidas: { select: { medidaTipoId: true, valorCm: true } },
          },
        },
        publicaciones: { select: { canal: true } },
      },
    });
    if (!product || product.kind !== "PRENDA" || !product.prenda) {
      return { success: false as const, error: "Prenda no encontrada" };
    }

    const data: PrendaEditable = {
      id: product.id,
      code: product.code,
      nombre: product.name,
      descripcion: product.description === "-" ? "" : (product.description ?? ""),
      precio: Number(product.price),
      categoriaPrendaId: product.prenda.categoriaId,
      condicionId: product.prenda.condicionId,
      talle: product.prenda.talle,
      detalleCondicion: product.prenda.detalleCondicion ?? "",
      detalleIntervencion: product.prenda.detalleIntervencion ?? "",
      costo: Number(product.prenda.costo),
      esUnica: product.prenda.esUnica,
      estilos: product.prenda.estilos.map((estilo) => estilo.estiloId),
      medidas: product.prenda.medidas.map((medida) => ({
        medidaTipoId: medida.medidaTipoId,
        valorCm: Number(medida.valorCm),
      })),
      publicadaEn: product.publicaciones.map((publicacion) => publicacion.canal),
    };

    return { success: true as const, data };
  } catch (error) {
    console.error("Error al obtener la prenda:", error);
    return { success: false as const, error: "Error al obtener la prenda" };
  }
}
