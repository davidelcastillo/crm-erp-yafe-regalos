// src/app/actions/product.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { readProductMovements, type ProductMovementRow } from "@/lib/product-movements";
import { sortProducts } from "@/lib/product-order";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNextCode, prefixLockKey } from "@/lib/utils/product-code";
import { registrarCompraDelAlta } from "@/lib/compra-alta";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import { createProductSchema, createProductsBatchSchema, updateProductExtendedSchema, sumaVariantes } from "@/lib/validations/product";

/** Motivo del ingreso inicial en el movimiento y en el comprobante (D9). */
const BATCH_ENTRY_REFERENCE = "ALTA DE PRODUCTOS";

/** Motivo del ingreso del alta individual (T3). */
const PRODUCT_ENTRY_REFERENCE = "ALTA DE PRODUCTO";

// Schema for searchProducts action
const searchProductsSchema = z.object({
  query: z.string().trim().optional(),
  branchId: z.coerce.number().int().positive().optional(),
});

// Schema para actualizar producto (code y codePrefix son READONLY; stock removido)
const updateProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo").optional(),
  description: z.string().max(2000, "La descripción es muy larga").optional().nullable(),
  price: z.number().min(0, "El precio no puede ser negativo").optional(),
  // code y codePrefix NO están en el schema - son inmutables tras creación
});

// Schema para eliminar producto
const deleteProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is Prisma P2002 unique constraint violation
 */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Object && "code" in error && error.code === "P2002";
}

/**
 * Mismo criterio que la prenda: los estilos elegidos tienen que existir y estar
 * activos. Una fila desactivada no entra en un alta ni en una edición.
 */
async function estilosInvalidos(ids: number[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const estilos = await prisma.estiloPrenda.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true },
  });
  return estilos.length === ids.length
    ? null
    : "Un estilo seleccionado no existe o está inactivo";
}

/** Las categorías elegidas tienen que existir (mismo criterio que los estilos). */
async function categoriasInvalidas(ids: number[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const categorias = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return categorias.length === ids.length
    ? null
    : "La categoría seleccionada no existe";
}

/**
 * Categorías que pide un payload. `categorias` manda; `categoryId` es la
 * principal heredada y solo se usa cuando la lista no viene (callers viejos).
 */
const categoriasDe = (data: { categorias?: number[]; categoryId?: number | null }): number[] =>
  data.categorias ?? (data.categoryId != null ? [data.categoryId] : []);

export async function createProduct(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = createProductSchema.parse(data);

    const estilosMalos = await estilosInvalidos(validatedData.estilos);
    if (estilosMalos) return { success: false as const, error: estilosMalos };

    // Categorías del producto (N:N): todas equivalentes y todas existentes.
    const categorias = categoriasDe(validatedData);
    const categoriasMalas = await categoriasInvalidas(categorias);
    if (categoriasMalas) return { success: false as const, error: categoriasMalas };

    // Sucursal del stock inicial (T3): se valida antes de escribir, como el lote.
    const branch =
      validatedData.branchId === undefined
        ? null
        : await prisma.branch.findFirst({
            where: { id: validatedData.branchId, isActive: true },
            select: { id: true },
          });
    if (validatedData.branchId !== undefined && !branch) {
      return { success: false as const, error: "Sucursal inválida o inactiva" };
    }
    const cantidadInicial =
      (validatedData.variantes?.length ?? 0) > 0
        ? sumaVariantes(validatedData.variantes)
        : (validatedData.cantidadInicial ?? 0);

    // Retry logic with advisory lock to handle race conditions
    const maxRetries = 3;
    const baseDelay = 50; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const product = await prisma.$transaction(async (tx) => {
          // Advisory lock on prefix hash to prevent concurrent code generation for same prefix
          const lockKey = prefixLockKey(validatedData.prefix);
          await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

          // Fetch existing codes for this prefix within transaction
          const existingProducts = await tx.product.findMany({
            where: { codePrefix: validatedData.prefix },
            select: { code: true },
          });

          // Generate next code using pure function (filter nulls)
          const existingCodes = existingProducts.map(p => p.code).filter((c): c is string => c !== null);
          const code = getNextCode(validatedData.prefix, existingCodes);

          // Create product with generated code (stock lives in BranchInventory)
          const creado = await tx.product.create({
            data: {
              name: validatedData.name,
              description: validatedData.description || "-",
              price: validatedData.price,
              code,
              codePrefix: validatedData.prefix,
              // La columna heredada queda con la primera categoría: la siguen
              // leyendo compras, ventas, reportes y etiquetas.
              categoryId: categorias[0] ?? null,
            },
          });

          // Categorías del producto (`ProductCategory`): todas equivalentes.
          if (categorias.length > 0) {
            await tx.productCategory.createMany({
              data: categorias.map((categoryId) => ({ productId: creado.id, categoryId })),
            });
          }

          // S3: «Publicar en» reutiliza `PrendaPublicacion`, la misma tabla
          // que la prenda (sin migración).
          if (validatedData.publicadaEn.length > 0) {
            await tx.prendaPublicacion.createMany({
              data: validatedData.publicadaEn.map((canal) => ({ productId: creado.id, canal })),
            });
          }

          // Estilos: la misma taxonomía que la prenda (`ProductEstilo`).
          if (validatedData.estilos.length > 0) {
            await tx.productEstilo.createMany({
              data: validatedData.estilos.map((estiloId) => ({ productId: creado.id, estiloId })),
            });
          }

          // Variantes: en el alta todavía no hay fotos, así que la posición se
          // elige después, en la edición.
          if (validatedData.variantes && validatedData.variantes.length > 0) {
            await tx.productVariante.createMany({
              data: validatedData.variantes.map((variante) => ({
                productId: creado.id,
                nombre: variante.nombre,
                cantidad: variante.cantidad,
              })),
            });
          }

          // Sin sucursal o sin cantidad no hay stock: ni inventario ni ENTRY.
          if (branch && cantidadInicial >= 1) {
            await tx.branchInventory.create({
              data: { branchId: branch.id, productId: creado.id, stock: cantidadInicial },
            });

            await tx.branchMovement.create({
              data: {
                productId: creado.id,
                branchId: branch.id,
                movementType: "ENTRY",
                quantity: cantidadInicial,
                reference: PRODUCT_ENTRY_REFERENCE,
                // `performedBy` es obligatorio: sin email queda un responsable explícito.
                performedBy: auth.email || "sistema",
              },
            });
          }

          // T3/S2: con costo > 0 la compra del alta se registra en la misma
          // transacción (solo registro: el ENTRY de arriba ya ingresó el stock).
          // Sin sucursal la compra queda con `branchId` null.
          if ((validatedData.costoUnitario ?? 0) > 0) {
            await registrarCompraDelAlta(tx, branch?.id ?? null, [
              {
                productId: creado.id,
                price: validatedData.costoUnitario!,
                quantity: cantidadInicial,
              },
            ]);
          }

          return creado;
        });

        return { success: true, data: parseObject(product) };
      } catch (txError) {
        // Retry on unique constraint violation (race condition)
        if (attempt < maxRetries && isUniqueConstraintError(txError)) {
          await sleep(baseDelay * attempt); // Exponential backoff: 50ms, 100ms, 200ms
          continue;
        }
        throw txError;
      }
    }

    // Should not reach here due to throw in loop
    throw new Error("Max retries exceeded for code generation");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (error instanceof Error && error.message.includes("agotado")) {
      return { success: false, error: error.message };
    }
    if (
      error instanceof Object &&
      "code" in error &&
      (error as { code: unknown }).code === "P2003"
    ) {
      // La categoría desapareció entre la elección y el guardado.
      return { success: false, error: "La categoría seleccionada no existe" };
    }
    console.error("Error creating product:", error);
    return { success: false, error: "Error al crear el producto" };
  }
}

type BatchRowError = { row: number; field?: string; message: string };

/** Errores de Zod por fila: el `path` del issue es ["rows", índice, campo]. */
function rowErrorsFromZodError(error: z.ZodError): BatchRowError[] {
  return error.issues.flatMap((issue) => {
    const [raiz, row, field] = issue.path;
    if (raiz !== "rows" || typeof row !== "number") return [];
    return [{ row, ...(typeof field === "string" ? { field } : {}), message: issue.message }];
  });
}

function batchFailure(error: string, rowErrors: BatchRowError[] = []) {
  return { success: false as const, error, ...(rowErrors.length > 0 ? { rowErrors } : {}) };
}

/**
 * Alta masiva de productos. Todo o nada (S7): cualquier falla revierte todas
 * las filas. Con `branchId`, el lote además deja el stock inicial de cada fila
 * en esa sucursal: `BranchInventory` siempre (S11, también en 0), movimiento
 * `ENTRY` y comprobante solo para las filas con stock (S2).
 */
export async function createProductsBatch(data: unknown) {
  // Se llena después de validar; el catch la usa para marcar el prefijo agotado.
  let filas: { prefix: string }[] = [];

  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = createProductsBatchSchema.safeParse(data);
    if (!parsed.success) {
      return batchFailure(
        parsed.error.issues.map((e) => e.message).join(", "),
        rowErrorsFromZodError(parsed.error)
      );
    }
    const { rows, branchId } = parsed.data;
    filas = rows;

    // Sucursal global del lote (D8): una sola consulta, antes de escribir nada.
    const branch =
      branchId === undefined
        ? null
        : await prisma.branch.findFirst({
            where: { id: branchId, isActive: true },
            select: { id: true, name: true, code: true },
          });
    if (branchId !== undefined && !branch) {
      return batchFailure("Sucursal inválida o inactiva");
    }

    // Categorías de cada fila (N:N): las distintas se verifican en UNA consulta,
    // nunca una por fila (H6).
    const categoriasDeLasFilas = rows.map((row) => categoriasDe(row));
    const categoriasPedidas = [...new Set(categoriasDeLasFilas.flat())];
    if (categoriasPedidas.length > 0) {
      const categorias = await prisma.category.findMany({
        where: { id: { in: categoriasPedidas } },
        select: { id: true },
      });
      const existentesIds = new Set(categorias.map((categoria) => categoria.id));
      const faltantes = new Set(categoriasPedidas.filter((id) => !existentesIds.has(id)));
      if (faltantes.size > 0) {
        return batchFailure(
          "La categoría seleccionada no existe",
          rows.flatMap((row, rowIndex) => {
            const ids = categoriasDeLasFilas[rowIndex];
            if (!ids.some((id) => faltantes.has(id))) return [];
            // La columna heredada conserva su propio campo de error.
            const field = (row.categorias ?? []).length > 0 ? "categorias" : "categoryId";
            return [
              {
                row: rowIndex,
                field,
                message: "La categoría seleccionada no existe",
              },
            ];
          })
        );
      }
    }

    // Los estilos de todas las filas se verifican en UNA consulta, igual que las
    // categorías: uno inactivo o inexistente marca solo las filas que lo usan.
    const estilosPedidos = [...new Set(rows.flatMap((row) => row.estilos))];
    if (estilosPedidos.length > 0) {
      const estilos = await prisma.estiloPrenda.findMany({
        where: { id: { in: estilosPedidos }, active: true },
        select: { id: true },
      });
      const activos = new Set(estilos.map((estilo) => estilo.id));
      const inactivos = new Set(estilosPedidos.filter((id) => !activos.has(id)));
      if (inactivos.size > 0) {
        const mensaje = "Un estilo seleccionado no existe o está inactivo";
        return batchFailure(
          mensaje,
          rows.flatMap((row, rowIndex) =>
            row.estilos.some((id) => inactivos.has(id))
              ? [{ row: rowIndex, field: "estilos", message: mensaje }]
              : []
          )
        );
      }
    }

    // Solo bloquean los nombres de productos ACTIVOS, sin distinguir mayúsculas (S3).
    const existentes = await prisma.product.findMany({
      where: {
        active: true,
        OR: rows.map((row) => ({ name: { equals: row.name.trim(), mode: "insensitive" } })),
      },
      select: { name: true },
    });
    if (existentes.length > 0) {
      const bloqueados = new Set(existentes.map((p) => p.name.trim().toLowerCase()));
      return batchFailure(
        "Ya existe un producto con ese nombre",
        rows.flatMap((row, rowIndex) =>
          bloqueados.has(row.name.trim().toLowerCase())
            ? [{ row: rowIndex, field: "name", message: "Ya existe un producto con ese nombre" }]
            : []
        )
      );
    }

    const maxRetries = 3;
    const baseDelay = 50;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resultado = await prisma.$transaction(
          async (tx) => {
            // Un lock por prefijo, ordenados y sin repetir: la misma clave que
            // `createProduct`, así el alta individual y el lote se serializan.
            const prefijos = [...new Set(rows.map((row) => row.prefix))].sort();
            for (const prefijo of prefijos) {
              await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${prefixLockKey(prefijo)})`);
            }

            const existentesCodigos = await tx.product.findMany({
              where: { codePrefix: { in: prefijos } },
              select: { code: true, codePrefix: true },
            });
            const codigosPorPrefijo = new Map<string, string[]>(prefijos.map((p) => [p, []]));
            for (const existente of existentesCodigos) {
              if (existente.code && existente.codePrefix) {
                codigosPorPrefijo.get(existente.codePrefix)?.push(existente.code);
              }
            }

            // Códigos en memoria: cada código generado suma a su prefijo, así el
            // mismo prefijo sigue contando y el tope de 999 se respeta.
            const codigos = rows.map((row) => {
              const delPrefijo = codigosPorPrefijo.get(row.prefix) ?? [];
              const code = getNextCode(row.prefix, delPrefijo);
              delPrefijo.push(code);
              codigosPorPrefijo.set(row.prefix, delPrefijo);
              return code;
            });

            const creados = await tx.product.createManyAndReturn({
              data: rows.map((row, i) => ({
                name: row.name,
                description: row.description || "-",
                price: row.price,
                code: codigos[i],
                codePrefix: row.prefix,
                // La columna heredada queda con la primera categoría de la fila.
                categoryId: categoriasDeLasFilas[i][0] ?? null,
              })),
              select: { id: true, code: true, name: true, price: true },
            });

            // `createManyAndReturn` no promete orden: se cruza por código.
            const porCodigo = new Map(creados.map((p) => [p.code, p]));
            const filasCreadas = rows.map((row, i) => {
              const creado = porCodigo.get(codigos[i]);
              if (!creado) throw new Error("No se pudo leer uno de los productos creados");
              return {
                producto: creado,
                // Con variantes el stock es la suma, igual que en el alta individual.
                stockInicial:
                  (row.variantes?.length ?? 0) > 0
                    ? sumaVariantes(row.variantes)
                    : (row.initialStock ?? 0),
                costo: row.costo ?? 0,
              };
            });
            const products = filasCreadas.map(({ producto }) => ({
              id: producto.id,
              code: producto.code,
              name: producto.name,
            }));

            // Estilos de cada fila: una sola `createMany` para todo el lote, con
            // el id real de cada producto cruzado por código (mismo índice).
            const estilosDelLote = filasCreadas.flatMap(({ producto }, i) =>
              rows[i].estilos.map((estiloId) => ({ productId: producto.id, estiloId }))
            );
            if (estilosDelLote.length > 0) {
              await tx.productEstilo.createMany({ data: estilosDelLote });
            }

            // Categorías de cada fila (`ProductCategory`), también en una sola
            // `createMany` para todo el lote.
            const categoriasDelLote = filasCreadas.flatMap(({ producto }, i) =>
              categoriasDeLasFilas[i].map((categoryId) => ({ productId: producto.id, categoryId }))
            );
            if (categoriasDelLote.length > 0) {
              await tx.productCategory.createMany({ data: categoriasDelLote });
            }

            // «Publicar en» de cada fila: una sola `createMany` para todo el
            // lote, cruzando por código como los estilos.
            const publicacionesDelLote = filasCreadas.flatMap(({ producto }, i) =>
              (rows[i].publicadaEn ?? []).map((canal) => ({ productId: producto.id, canal }))
            );
            if (publicacionesDelLote.length > 0) {
              await tx.prendaPublicacion.createMany({ data: publicacionesDelLote });
            }

            // Variantes: una sola `createMany` para todo el lote (sin fotos:
            // el producto recién se está creando).
            const variantesDelLote = rows.flatMap((row, i) =>
              (row.variantes ?? []).map((variante) => ({
                productId: filasCreadas[i].producto.id,
                nombre: variante.nombre,
                cantidad: variante.cantidad,
              }))
            );
            if (variantesDelLote.length > 0) {
              await tx.productVariante.createMany({ data: variantesDelLote });
            }

            // T4: UNA sola compra del lote, solo con las filas que tienen costo y
            // stock cargado. El ENTRY de abajo ya ingresa el stock: la compra no lo toca.
            const itemsDeCompra = filasCreadas
              .filter((fila) => fila.costo > 0 && fila.stockInicial > 0)
              .map(({ producto, stockInicial, costo }) => ({
                productId: producto.id,
                price: costo,
                quantity: stockInicial,
              }));

            // Sin sucursal no hay stock, pero la compra del alta se registra igual
            // (branchId null) y el lote no crea inventario ni movimientos.
            if (!branch) {
              if (itemsDeCompra.length > 0) {
                await registrarCompraDelAlta(tx, null, itemsDeCompra);
              }
              return { products, receipt: null };
            }

            // S11: la fila de inventario se crea siempre, también con stock 0,
            // para que el producto nuevo se vea en la vista por sucursal (H1).
            const inventarios = await tx.branchInventory.createManyAndReturn({
              data: filasCreadas.map(({ producto, stockInicial }) => ({
                branchId: branch.id,
                productId: producto.id,
                stock: stockInicial,
              })),
              select: { productId: true, stock: true },
            });
            const stockPorProducto = new Map(inventarios.map((i) => [i.productId, i.stock]));

            // Stock 0 no es un ingreso: no deja movimiento ni va al comprobante.
            const conStock = filasCreadas.filter((fila) => fila.stockInicial > 0);
            if (conStock.length > 0) {
              await tx.branchMovement.createMany({
                data: conStock.map(({ producto, stockInicial }) => ({
                  productId: producto.id,
                  branchId: branch.id,
                  movementType: "ENTRY",
                  quantity: stockInicial,
                  reference: BATCH_ENTRY_REFERENCE,
                  // Calidad de auditoría, no un fix de la base: `performedBy` es
                  // TEXT NOT NULL y acepta "" igual, pero un ingreso sin responsable es ilegible.
                  // Fallback explícito: `requireAdmin` puede devolver email vacío y `performedBy` es obligatorio.
                  performedBy: auth.email || "sistema",
                })),
              });
            }

            // T4: la compra usa el mismo conjunto de filas (costo y stock); el
            // ENTRY de arriba ya ingresó el stock, así que la compra no lo toca.
            if (itemsDeCompra.length > 0) {
              await registrarCompraDelAlta(tx, branch.id, itemsDeCompra);
            }

            const receipt: StockMovementReceipt | null =
              conStock.length === 0
                ? null
                : {
                    movementType: "ENTRY",
                    branchId: branch.id,
                    date: new Date().toISOString(),
                    branchName: branch.name,
                    branchCode: branch.code,
                    reference: BATCH_ENTRY_REFERENCE,
                    rows: conStock.map(({ producto, stockInicial }) => ({
                      productId: producto.id,
                      code: producto.code,
                      name: producto.name,
                      price: Number(producto.price),
                      quantity: stockInicial,
                      // Saldo confirmado por la transacción, no supuesto.
                      stock: stockPorProducto.get(producto.id)!,
                    })),
                  };

            return { products, receipt };
          },
          { timeout: 20_000 }
        );

        revalidatePath("/inventario");
        revalidatePath("/productos");
        if (resultado.receipt) revalidatePath("/movimientos");
        return { success: true as const, data: resultado };
      } catch (txError) {
        if (attempt < maxRetries && isUniqueConstraintError(txError)) {
          await sleep(baseDelay * attempt);
          continue;
        }
        throw txError;
      }
    }

    throw new Error("Max retries exceeded for code generation");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return batchFailure(
        error.issues.map((e) => e.message).join(", "),
        rowErrorsFromZodError(error)
      );
    }
    if (error instanceof Error && error.message.includes("agotado")) {
      // `getNextCode` nombra el prefijo agotado: esas filas son las que fallan.
      const prefijo = /Prefijo\s+([A-Za-z]{2,4})\s+agotado/.exec(error.message)?.[1]?.toUpperCase();
      return batchFailure(
        error.message,
        prefijo
          ? filas.flatMap((fila, row) =>
              fila.prefix === prefijo ? [{ row, message: error.message }] : []
            )
          : []
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "P2003"
    ) {
      return batchFailure("La categoría seleccionada no existe");
    }
    console.error("Error creating products batch:", error);
    return batchFailure("Error al crear los productos");
  }
}

export async function getProducts(branchId?: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(branchId ? { inventory: { some: { branchId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        inventory: {
          where: { branchId },
          select: { stock: true },
        },
      },
    });
    return { success: true, data: parseArray(products) };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, error: "Error al obtener los productos" };
  }
}

export async function getProductById(id: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const product = await prisma.product.findUnique({
      where: { id },
      // La edición necesita los canales ya publicados (S3), los estilos
      // guardados y las variantes, para precargarlos sin borrarlos.
      include: {
        publicaciones: { select: { canal: true } },
        estilosProducto: { select: { estiloId: true } },
        // Categorías del producto (N:N): la edición las precarga todas.
        categorias: { select: { categoryId: true } },
        variantes: {
          orderBy: { id: "asc" },
          select: { nombre: true, cantidad: true, fotoPosition: true },
        },
      },
    });
    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }
    const { publicaciones, estilosProducto, categorias, variantes, ...ficha } = product;
    return {
      success: true,
      data: parseObject({
        ...ficha,
        publicadaEn: publicaciones.map((publicacion) => publicacion.canal),
        estilos: estilosProducto.map((estilo) => estilo.estiloId),
        categorias: categorias.map((fila) => fila.categoryId),
        variantes,
      }),
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return { success: false, error: "Error al obtener el producto" };
  }
}

export async function updateProduct(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = updateProductSchema.parse(data);

    const product = await prisma.product.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.price !== undefined && { price: validatedData.price }),
        // code, codePrefix y stock no se actualizan aquí
      },
    });

    return { success: true, data: parseObject(product) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error updating product:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}

export async function deleteProduct(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = deleteProductSchema.parse(data);

    await prisma.product.delete({
      where: { id: validatedData.id },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto" };
  }
}

/**
 * Search products by code or name (case-insensitive)
 * Returns max 20 results with minimal projection for performance
 * Empty query returns empty array (no default list)
 */
export async function searchProducts(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { query, branchId } = searchProductsSchema.parse(data);

    // Empty or whitespace-only query returns empty array (no DB call)
    if (!query || query.trim() === "") {
      return { success: true, data: [] };
    }

    const products = await prisma.product.findMany({
      where: {
        // Con sucursal (ventas) solo se ofrece lo que hay en esa sucursal; sin
        // sucursal (etiquetas) no se puede filtrar por stock.
        ...(branchId ? { inventory: { some: { branchId, stock: { gt: 0 } } } } : {}),
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        inventory: {
          where: { branchId: branchId ?? undefined },
          select: { stock: true, branchId: true },
        },
      },
      take: 20,
    });

    // Flatten branch inventory into a single `stock` value per product for compatibility
    const flattened = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price,
      stock: p.inventory[0]?.stock ?? 0,
    }));

    return { success: true, data: parseArray(flattened) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error searching products:", error);
    return { success: false, error: "Error al buscar productos" };
  }
}

/**
 * Get movement history for a product (purchases and sales)
 * @param productId The product ID
 * @returns Promise resolving to an array of movement objects
 */
/** Rango del historial: desde el último control de stock o desde la creación (S4). */
const productMovementsOptionsSchema = z.object({
  range: z.enum(["created", "last-control"]).default("created"),
  branchId: z.number().int().positive().nullable().default(null),
});

/**
 * Historial de movimientos del producto. El rango «desde el último control» es
 * por sucursal: sin sucursal —o si esa sucursal nunca tuvo un control cerrado—
 * cae a «desde la creación», y el `meta` lo dice para que la UI lo aclare en
 * lugar de mostrar una lista vacía sin explicación.
 */
export async function getProductMovements(
  productId: number,
  options?: { range?: "created" | "last-control"; branchId?: number | null }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { range, branchId } = productMovementsOptionsSchema.parse(options ?? {});

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { createdAt: true },
    });
    if (!product) return { success: false as const, error: "Producto no encontrado" };

    const control =
      range === "last-control" && branchId !== null
        ? await prisma.stockControl.findFirst({
            where: { branchId, status: "CLOSED", closedAt: { not: null } },
            orderBy: { closedAt: "desc" },
            select: { closedAt: true },
          })
        : null;
    const controlClosedAt = control?.closedAt ?? null;
    const desde = controlClosedAt ?? product.createdAt;

    const rows = await readProductMovements({
      productIds: [productId],
      since: desde,
      branchId,
    });
    // El historial interno no necesita el código del producto: ya es el abierto.
    const allMovements: ProductMovement[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      date: row.date,
      quantity: row.quantity,
      referenceId: row.referenceId,
      reference: row.reference,
      branchName: row.branchName,
    }));

    return {
      success: true,
      data: parseArray(allMovements),
      // La UI necesita saber qué rango se aplicó de verdad y desde cuándo.
      meta: {
        range: controlClosedAt ? ("last-control" as const) : ("created" as const),
        requestedRange: range,
        since: desde.toISOString(),
        controlClosedAt: controlClosedAt?.toISOString() ?? null,
        branchId,
      },
    };
  } catch (error) {
    console.error("Error fetching product movements:", error);
    return { success: false, error: "Error al obtener los movimientos del producto" };
  }
}

// Movimiento del historial de un producto: documentos (compra/venta) y
// movimientos del libro de sucursal (transferencias y ajustes).
export type ProductMovement = Omit<
  ProductMovementRow,
  "productId" | "productCode"
>;

// ===========================================================================
// Fase 3: Producto activo/inactivo + actualizar extendido (categoryId, active)
// ===========================================================================

const toggleProductActiveSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  active: z.boolean(),
});

/**
 * Activa/desactiva un producto (soft-delete vía `Product.active`).
 * NO propaga `active` a `BranchInventory`: el stock persiste para historial.
 * Solo afecta los selectores (`getActiveProducts`) y el listado de inactivos.
 */
export async function toggleProductActive(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { id, active } = toggleProductActiveSchema.parse(data);

    await prisma.product.update({
      where: { id },
      data: { active },
    });

    revalidatePath("/productos");
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error toggling product active:", error);
    return { success: false, error: "Error al actualizar el estado del producto" };
  }
}

/**
 * Productos activos (`active=true`) — para selectores y flujos de compra/venta.
 */
export async function getActiveProducts(branchId?: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(branchId ? { inventory: { some: { branchId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        inventory: {
          where: { branchId },
          select: { stock: true },
        },
      },
    });
    return { success: true, data: parseArray(products) };
  } catch (error) {
    console.error("Error fetching active products:", error);
    return { success: false, error: "Error al obtener los productos activos" };
  }
}

/**
 * Productos inactivos (`active=false`) — para la página de inactivos.
 * El orden por defecto es por código (S4); la página ofrece el cambio a última
 * modificación sobre la lista ya cargada.
 */
export async function getInactiveProducts() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const products = await prisma.product.findMany({
      where: { active: false },
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { id: true, name: true } } },
    });
    return { success: true, data: parseArray(sortProducts(products)) };
  } catch (error) {
    console.error("Error fetching inactive products:", error);
    return { success: false, error: "Error al obtener los productos inactivos" };
  }
}

/**
 * Reactiva un producto previamente desactivado (`active=true`).
 * Es un azúcar sintáctico de `toggleProductActive({id, active: true})`.
 */
export async function reactivateProduct(data: unknown) {
  const reactivateSchema = z.object({ id: z.number().int().positive("ID inválido") });
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { id } = reactivateSchema.parse(data);

    await prisma.product.update({
      where: { id },
      data: { active: true },
    });

    revalidatePath("/productos");
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error reactivating product:", error);
    return { success: false, error: "Error al reactivar el producto" };
  }
}

/**
 * Actualización extendida del producto (Fase 3):
 * añade `categoryId` (nullable) y `active` a los campos actualizables.
 * No reemplaza `updateProduct` existente (que no incluye categoryId/active)
 * para preservar callers de HU2. `code`/`codePrefix` siguen inmutables.
 */
export async function updateProductExtended(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const validatedData = updateProductExtendedSchema.parse(data);

    const estilosMalos = await estilosInvalidos(validatedData.estilos ?? []);
    if (estilosMalos) return { success: false as const, error: estilosMalos };

    // Con la lista de categorías presente se reemplaza entera y se valida que
    // existan; sin la lista, la edición no toca las del producto.
    const tocaCategorias = validatedData.categorias !== undefined;
    if (tocaCategorias) {
      const categoriasMalas = await categoriasInvalidas(validatedData.categorias ?? []);
      if (categoriasMalas) return { success: false as const, error: categoriasMalas };
    }

    // La foto de la variante tiene que existir: guarda la `position` de una foto
    // del propio producto. En el alta se ignora porque todavía no hay ninguna.
    const tocaVariantes = validatedData.variantes !== undefined;
    if (tocaVariantes && (validatedData.variantes?.length ?? 0) > 0) {
      const posiciones = new Set(
        (
          await prisma.productImage.findMany({
            where: { productId: validatedData.id },
            select: { position: true },
          })
        ).map((foto) => foto.position)
      );
      const fotoInexistente = (validatedData.variantes ?? []).some(
        (variante) => variante.fotoPosition !== undefined && !posiciones.has(variante.fotoPosition)
      );
      if (fotoInexistente) {
        return { success: false as const, error: "La foto de la variante no existe" };
      }
    }

    const cambios = {
      ...(validatedData.name && { name: validatedData.name }),
      ...(validatedData.description !== undefined && {
        description: validatedData.description,
      }),
      ...(validatedData.price !== undefined && { price: validatedData.price }),
      // `categorias` manda y deja `categoryId` sincronizado con la primera: la
      // columna heredada la siguen leyendo compras, ventas, reportes y etiquetas.
      ...(validatedData.categorias !== undefined
        ? { categoryId: validatedData.categorias[0] ?? null }
        : validatedData.categoryId !== undefined
          ? { categoryId: validatedData.categoryId }
          : {}),
      ...(validatedData.active !== undefined && { active: validatedData.active }),
    };

    // S3: «Publicar en» reemplaza las filas de `PrendaPublicacion` en la misma
    // transacción que la ficha. Los estilos hacen lo mismo con `ProductEstilo`,
    // las variantes con `ProductVariante` y las categorías con `ProductCategory`.
    // Sin el campo, cada uno queda como estaba.
    const tocaPublicaciones = validatedData.publicadaEn !== undefined;
    const tocaEstilos = validatedData.estilos !== undefined;
    const product =
      !tocaPublicaciones && !tocaEstilos && !tocaVariantes && !tocaCategorias
        ? await prisma.product.update({ where: { id: validatedData.id }, data: cambios })
        : await prisma.$transaction(async (tx) => {
            const actualizado = await tx.product.update({
              where: { id: validatedData.id },
              data: cambios,
            });
            if (tocaPublicaciones) {
              await tx.prendaPublicacion.deleteMany({ where: { productId: validatedData.id } });
              // `publicadaEn` no es undefined en esta rama; el chequeo es por el cierre.
              if (validatedData.publicadaEn && validatedData.publicadaEn.length > 0) {
                await tx.prendaPublicacion.createMany({
                  data: validatedData.publicadaEn.map((canal) => ({
                    productId: validatedData.id,
                    canal,
                  })),
                });
              }
            }
            if (tocaEstilos) {
              await tx.productEstilo.deleteMany({ where: { productId: validatedData.id } });
              if (validatedData.estilos && validatedData.estilos.length > 0) {
                await tx.productEstilo.createMany({
                  data: validatedData.estilos.map((estiloId) => ({
                    productId: validatedData.id,
                    estiloId,
                  })),
                });
              }
            }
            if (tocaCategorias) {
              await tx.productCategory.deleteMany({ where: { productId: validatedData.id } });
              if (validatedData.categorias && validatedData.categorias.length > 0) {
                await tx.productCategory.createMany({
                  data: validatedData.categorias.map((categoryId) => ({
                    productId: validatedData.id,
                    categoryId,
                  })),
                });
              }
            }
            if (tocaVariantes) {
              await tx.productVariante.deleteMany({ where: { productId: validatedData.id } });
              if (validatedData.variantes && validatedData.variantes.length > 0) {
                await tx.productVariante.createMany({
                  data: validatedData.variantes.map((variante) => ({
                    productId: validatedData.id,
                    nombre: variante.nombre,
                    cantidad: variante.cantidad,
                    fotoPosition: variante.fotoPosition ?? null,
                  })),
                });
              }
            }
            return actualizado;
          });

    revalidatePath("/productos");
    revalidatePath(`/productos/${validatedData.id}`);
    revalidatePath("/inventario");
    revalidatePath("/inventario/inactivos");
    return { success: true, data: parseObject(product) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "P2003"
    ) {
      // Foreign key constraint fail on categoryId
      return { success: false, error: "La categoría seleccionada no existe" };
    }
    console.error("Error updating product extended:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}