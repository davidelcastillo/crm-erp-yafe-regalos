// src/app/actions/foto.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_BYTES_FOTO,
  MAX_FOTOS,
  PRODUCT_IMAGES_BUCKET,
  TAMANOS_FOTO,
  nombreFoto,
  nombresFoto,
  posicionLibre,
  type TamanoFoto,
} from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Fotos de producto (S1/S4): hasta 4 por `Product` de cualquier kind, posición
 * 0 = portada. El archivo lo redimensiona el navegador y lo sube directo al
 * bucket con una URL firmada que emite `firmarSubidaFoto`; la fila la escribe
 * `confirmarFoto`. `requireAdmin()` va primero en las cuatro acciones, antes de
 * Zod y de Prisma (`auth-guard.coverage.test.ts`).
 */

const zodMessage = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(", ");

/** El navegador manda el SHA-256 en hex: solo eso llega a formar parte del path. */
const hashSchema = z
  .string()
  .regex(/^[a-f0-9]{16,64}$/i, "Hash de archivo inválido");

const firmarSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  hash: hashSchema,
  bytes: z
    .number()
    .int()
    .positive("El tamaño del archivo es inválido")
    .max(MAX_BYTES_FOTO, "Cada archivo no puede superar 2 MB"),
});

const confirmarSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  hash: hashSchema,
  alt: z.string().trim().max(200, "El texto alternativo es demasiado largo").optional(),
  bytes: z.number().int().nonnegative().max(MAX_BYTES_FOTO).optional(),
});

const quitarSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  position: z.number().int().min(0).max(MAX_FOTOS - 1, "Posición inválida"),
});

const fotosSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
});

type SubidaFirmada = { path: string; token: string; signedUrl: string };

/**
 * Emite las dos URLs firmadas de una foto. El path lo calcula el servidor a
 * partir del producto y el hash, así el cliente solo puede escribir
 * `<productId>/<hash>_lg/_sm.webp` y dos productos nunca comparten objeto.
 *
 * shortcut: la URL de subida vence a las 2 h que fija Storage; `supabase-js` no
 * expone `expiresIn` para subidas firmadas. El riesgo está acotado: la URL solo
 * escribe esos dos nombres fijos y la fila recién existe con `confirmarFoto`.
 */
export async function firmarSubidaFoto(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = firmarSchema.parse(data);
    const bucket = createAdminClient().storage.from(PRODUCT_IMAGES_BUCKET);
    const subidas = {} as Record<TamanoFoto, SubidaFirmada>;

    for (const tamano of TAMANOS_FOTO) {
      const path = nombreFoto(parsed.productId, parsed.hash, tamano);
      const { data: firmada, error } = await bucket.createSignedUploadUrl(path);

      if (error || !firmada) {
        console.error("Error al firmar la subida de la foto:", error);
        return { success: false as const, error: "No se pudo firmar la subida de la foto" };
      }

      subidas[tamano] = { path, token: firmada.token, signedUrl: firmada.signedUrl };
    }

    return { success: true as const, data: { subidas } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al firmar la subida de la foto:", error);
    return { success: false as const, error: "Error al firmar la subida de la foto" };
  }
}

/**
 * Escribe la fila de la foto ya subida. La posición no la manda el cliente: es
 * la primera libre de 0..3, y con 4 fotos se rechaza. El chequeo y el insert
 * van en la misma transacción; `@@unique([productId, position])` corta cualquier
 * carrera que se cuele entre dos confirmaciones simultáneas.
 */
export async function confirmarFoto(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = confirmarSchema.parse(data);

    const resultado = await prisma.$transaction(async (tx) => {
      const producto = await tx.product.findUnique({
        where: { id: parsed.productId },
        select: { id: true },
      });
      if (!producto) return { error: "Producto no encontrado" as const };

      const existentes = await tx.productImage.findMany({
        where: { productId: parsed.productId },
        select: { position: true },
      });
      const position = posicionLibre(existentes.map((foto) => foto.position));
      if (position === null) {
        return { error: `El producto ya tiene ${MAX_FOTOS} fotos` as const };
      }

      await tx.productImage.create({
        data: {
          productId: parsed.productId,
          position,
          path: parsed.hash,
          alt: parsed.alt || null,
          bytes: parsed.bytes ?? 0,
        },
      });

      return { position };
    });

    if ("error" in resultado) return { success: false as const, error: resultado.error };

    revalidatePath("/inventario");
    revalidatePath("/productos");
    return { success: true as const, data: { position: resultado.position } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al confirmar la foto:", error);
    return { success: false as const, error: "Error al confirmar la foto" };
  }
}

/**
 * Borra la foto y compacta las posiciones restantes a 0..n-1, así la portada
 * pasa a ser la primera que quede. El objeto del bucket se borra después de la
 * transacción y best-effort: si Storage falla, la ficha ya no muestra la foto.
 */
export async function quitarFoto(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = quitarSchema.parse(data);
    const clave = { productId: parsed.productId, position: parsed.position };

    const borrada = await prisma.$transaction(async (tx) => {
      const foto = await tx.productImage.findUnique({
        where: { productId_position: clave },
        select: { path: true },
      });
      if (!foto) return null;

      await tx.productImage.delete({ where: { productId_position: clave } });

      const restantes = await tx.productImage.findMany({
        where: { productId: parsed.productId },
        orderBy: { position: "asc" },
        select: { position: true },
      });

      // Ascendente: cada destino ya quedó libre por el borrado o por la fila
      // anterior, así el unique nunca choca a mitad de camino.
      for (const [indice, restante] of restantes.entries()) {
        if (restante.position === indice) continue;
        await tx.productImage.update({
          where: {
            productId_position: { productId: parsed.productId, position: restante.position },
          },
          data: { position: indice },
        });
      }

      return foto.path;
    });

    if (borrada === null) return { success: false as const, error: "Foto no encontrada" };

    const { error } = await createAdminClient()
      .storage.from(PRODUCT_IMAGES_BUCKET)
      .remove(nombresFoto(parsed.productId, borrada));
    if (error) console.error("No se pudieron borrar las fotos del bucket:", error);

    revalidatePath("/inventario");
    revalidatePath("/productos");
    return { success: true as const, data: { position: parsed.position } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al quitar la foto:", error);
    return { success: false as const, error: "Error al quitar la foto" };
  }
}

/** Fotos de la ficha interna, ordenadas por posición (consumida por los formularios). */
export async function getFotosProducto(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = fotosSchema.parse(data);
    const fotos = await prisma.productImage.findMany({
      where: { productId: parsed.productId },
      orderBy: { position: "asc" },
      select: { position: true, path: true, alt: true, bytes: true },
    });

    return { success: true as const, data: fotos };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al obtener las fotos:", error);
    return { success: false as const, error: "Error al obtener las fotos" };
  }
}
