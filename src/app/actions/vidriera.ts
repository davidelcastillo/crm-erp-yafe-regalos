// src/app/actions/vidriera.ts
"use server";
/**
 * Vidriera pública `/polkalinas` (T4/T5, S2 y S4 de
 * `odd/tasks/fotos-vidriera-polkalinas.md`).
 *
 * Es la **única** action sin guardián, igual que el catálogo público
 * (`inventory.external.ts`): solo lectura, sobre lo publicado en el canal «Web»
 * de `PrendaPublicacion` y con una lista cerrada de campos públicos. Nada de
 * costos, clientes, stock por sucursal ni notas internas — el select de cada
 * consulta es el contrato (`vidriera.test.ts` lo compara exacto). La ficha
 * publica el **nombre** de las sucursales con stock > 0 (dónde retirar), nunca
 * la cifra.
 *
 * El stock y las ventas se usan **solo para derivar el estado**; el número no
 * sale de acá.
 */
import { prisma } from "@/lib/prisma";
import { PRODUCT_IMAGES_BUCKET, nombreFoto, type TamanoFoto } from "@/lib/storage";
import { z } from "zod";

/** Canal de `PrendaPublicacion` que publica en la vidriera. */
const CANAL_WEB = "Web";

export type EstadoVidriera = "DISPONIBLE" | "RESERVADA" | "VENDIDA" | "AGOTADO";

export type VidrieraItem = {
  id: number;
  code: string;
  name: string;
  /** Precio público ya convertido: la acción devuelve `Decimal` como `number`. */
  price: number;
  kind: "PRENDA" | "PRODUCT";
  estado: EstadoVidriera;
  /** Portada (posición 0) en miniatura, o `null` si el producto no tiene fotos. */
  portada: string | null;
  /** Categoría de prenda; los productos normales usan su `Category`. */
  categoria: string | null;
  /** Id de `categoria` (prenda o `Category` del producto). Opcional en el tipo
   * para no romper los fixtures de las páginas en rediseño; la action lo manda. */
  categoriaId?: number | null;
  /** Talles disponibles de una prenda (vacío en productos normales). */
  talles?: string[];
};

export type VidrieraFicha = VidrieraItem & {
  /** Todas las fotos en tamaño ficha, de la portada en adelante. */
  fotos: { url: string; alt: string }[];
  /** `Product.description`, con el placeholder histórico `"-"` ya vaciado.
   * Opcional en el tipo por lo mismo que `categoriaId`. */
  descripcion?: string;
  /** Nombres de las sucursales con stock > 0: dónde se puede retirar.
   * Opcional en el tipo por lo mismo que `categoriaId`. */
  sucursales?: { id: number; name: string }[];
  condicion: string | null;
  detalleCondicion: string | null;
  talles: string[];
};

/** URL pública y estable del bucket (ADR-08). Mismo criterio que `urlFoto`;
 * lee la variable pública de storage cuando está definida (desarrollo local). */
const urlFoto = (productId: number, path: string, tamano: TamanoFoto) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${nombreFoto(productId, path, tamano)}`;

const SELECT_LISTA = {
  id: true,
  code: true,
  name: true,
  price: true,
  kind: true,
  images: { orderBy: { position: "asc" }, select: { path: true, alt: true } },
  prenda: {
    select: {
      categoria: { select: { id: true, name: true } },
      condicion: { select: { name: true } },
      // Las cards muestran el talle en lugar del código (pedido del dueño).
      talles: { select: { talle: true, cantidad: true }, orderBy: { talle: "asc" } },
    },
  },
} as const;

const SELECT_FICHA = {
  ...SELECT_LISTA,
  // La ficha también publica descripción y categoría de los productos normales.
  description: true,
  category: { select: { id: true, name: true } },
  prenda: {
    select: {
      ...SELECT_LISTA.prenda.select,
      detalleCondicion: true,
      talles: { orderBy: { talle: "asc" }, select: { talle: true } },
    },
  },
} as const;

type FilaPublica = {
  id: number;
  code: string;
  name: string;
  price: unknown;
  kind: "PRENDA" | "PRODUCT";
  images: { path: string; alt: string | null }[];
  /** Solo lo pide `SELECT_FICHA` (la lista no los publica). */
  description?: string | null;
  category?: { id: number; name: string } | null;
  prenda: {
    categoria: { id: number; name: string } | null;
    condicion: { name: string } | null;
    detalleCondicion?: string | null;
    talles?: { talle: string }[];
  } | null;
};

/**
 * Estado que ve el visitante (ADR `prendas-pedidos-diseno-logica.md` §1.3): no
 * se guarda, se deriva. En una prenda «Vendida» exige una venta además de stock
 * 0: una baja por ajuste no es una venta. En un producto manda el stock.
 */
const estadoDe = (
  fila: FilaPublica,
  stock: number,
  reservado: boolean,
  vendido: boolean
): EstadoVidriera => {
  if (fila.kind === "PRODUCT") return stock > 0 ? "DISPONIBLE" : "AGOTADO";
  if (stock === 0 && vendido) return "VENDIDA";
  if (reservado) return "RESERVADA";
  return stock > 0 ? "DISPONIBLE" : "AGOTADO";
};

const aPublico = (
  fila: FilaPublica,
  stock: number,
  reservado: boolean,
  vendido: boolean
): VidrieraItem => ({
  id: fila.id,
  code: fila.code,
  name: fila.name,
  price: Number(fila.price),
  kind: fila.kind,
  estado: estadoDe(fila, stock, reservado, vendido),
  portada: fila.images[0] ? urlFoto(fila.id, fila.images[0].path, "sm") : null,
  categoria: fila.prenda?.categoria?.name ?? null,
  // Talles disponibles (solo prendas): la card los muestra en lugar del código.
  talles: fila.prenda?.talles?.map((filaTalle) => filaTalle.talle) ?? [],
});

/** Sucursales donde el ítem tiene stock > 0: disponibilidad pública, sin el número. */
const sucursalesConStock = async (productId: number) =>
  (
    await prisma.branchInventory.findMany({
      // Solo sucursales activas: una desactivada no es punto de retiro.
      where: { productId, stock: { gt: 0 }, branch: { isActive: true } },
      select: { branch: { select: { id: true, name: true } } },
      orderBy: { branch: { name: "asc" } },
    })
  ).map((fila) => fila.branch);

/** Stock total por producto, pedidos abiertos y ventas, de una lista de ids. */
const leerEstado = async (ids: number[]) => {
  const [stock, reservados, vendidos] = await Promise.all([
    ids.length === 0
      ? []
      : prisma.branchInventory.groupBy({
          by: ["productId"],
          where: { productId: { in: ids } },
          _sum: { stock: true },
        }),
    ids.length === 0
      ? []
      : prisma.pedidoItem.findMany({
          where: { productId: { in: ids }, pedido: { estado: "RESERVADO" } },
          distinct: ["productId"],
          select: { productId: true },
        }),
    ids.length === 0
      ? []
      : prisma.saleItem.findMany({
          where: { productId: { in: ids } },
          distinct: ["productId"],
          select: { productId: true },
        }),
  ]);

  return {
    stockPorProducto: new Map(stock.map((fila) => [fila.productId, fila._sum.stock ?? 0])),
    reservados: new Set(reservados.map((fila) => fila.productId)),
    vendidos: new Set(vendidos.map((fila) => fila.productId)),
  };
};

const filtrosSchema = z.object({
  categoriaId: z.number().int().positive().optional(),
  q: z.string().trim().max(80, "La búsqueda es demasiado larga").optional(),
});

const zodMessage = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(", ");

/**
 * Catálogo público: prendas y productos marcados «Publicar en: Web», con el
 * estado derivado, la portada y las categorías de prenda para los chips.
 */
export async function getVidriera(filtros?: unknown) {
  try {
    const parsed = filtrosSchema.parse(filtros ?? {});
    const q = parsed.q?.trim();

    const productos = await prisma.product.findMany({
      where: {
        active: true,
        publicaciones: { some: { canal: CANAL_WEB } },
        ...(parsed.categoriaId ? { prenda: { categoriaId: parsed.categoriaId } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: SELECT_LISTA,
      orderBy: { name: "asc" },
    });

    const ids = productos.map((producto) => producto.id);
    const [{ stockPorProducto, reservados, vendidos }, categorias] = await Promise.all([
      leerEstado(ids),
      prisma.categoriaPrenda.findMany({
        where: {
          active: true,
          prendas: {
            some: {
              product: { active: true, publicaciones: { some: { canal: CANAL_WEB } } },
            },
          },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      success: true as const,
      data: {
        items: productos.map((producto) =>
          aPublico(
            producto,
            stockPorProducto.get(producto.id) ?? 0,
            reservados.has(producto.id),
            vendidos.has(producto.id)
          )
        ),
        categorias,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al obtener la vidriera:", error);
    return { success: false as const, error: "Error al obtener la vidriera" };
  }
}

const fichaSchema = z.object({
  id: z.number().int().positive("Producto inválido"),
});

/**
 * Ficha pública de un ítem publicado. No publicado, borrado o inexistente dan
 * la misma respuesta: el mensaje no distingue el motivo (igual que el catálogo
 * público), así no se filtra la existencia de un producto sin publicar.
 */
export async function getVidrieraItem(data: unknown) {
  try {
    const { id } = fichaSchema.parse(data);

    const fila = await prisma.product.findFirst({
      where: { id, active: true, publicaciones: { some: { canal: CANAL_WEB } } },
      select: SELECT_FICHA,
    });
    if (!fila) return { success: false as const };

    const [{ stockPorProducto, reservados, vendidos }, sucursales] = await Promise.all([
      leerEstado([fila.id]),
      sucursalesConStock(fila.id),
    ]);
    const item = aPublico(
      fila,
      stockPorProducto.get(fila.id) ?? 0,
      reservados.has(fila.id),
      vendidos.has(fila.id)
    );
    // La ficha suma la categoría del producto normal (la prenda ya la trae).
    const categoria = fila.prenda?.categoria ?? fila.category ?? null;

    return {
      success: true as const,
      data: {
        ...item,
        categoria: categoria?.name ?? null,
        categoriaId: categoria?.id ?? null,
        fotos: fila.images.map((foto) => ({
          url: urlFoto(fila.id, foto.path, "lg"),
          // Sin alt cargado se usa el nombre: la foto nunca queda sin texto.
          alt: foto.alt ?? fila.name,
        })),
        condicion: fila.prenda?.condicion?.name ?? null,
        detalleCondicion: fila.prenda?.detalleCondicion ?? null,
        talles: fila.prenda?.talles?.map((talle) => talle.talle) ?? [],
        descripcion: fila.description === "-" ? "" : (fila.description ?? ""),
        sucursales,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al obtener la ficha de la vidriera:", error);
    return { success: false as const, error: "Error al obtener la ficha de la vidriera" };
  }
}
