// src/lib/validations/product.ts
import { z } from "zod";
import { CANALES_PUBLICACION, type CanalPublicacion } from "@/lib/validations/prenda";

/**
 * «Publicar en» (T3 de `odd/tasks/fotos-vidriera-polkalinas.md`, S3): los
 * mismos canales y el mismo filtro que la prenda. Vacío o desconocido se
 * ignora; sin el campo la edición no toca las publicaciones existentes.
 */
const filtrarCanales = (canales: string[]): CanalPublicacion[] => [
  ...new Set(
    canales
      .map((canal) => canal.trim())
      .filter((canal): canal is CanalPublicacion =>
        (CANALES_PUBLICACION as readonly string[]).includes(canal)
      )
  ),
];

/** Alta: sin canales queda vacío (publica en ninguno). */
const publicadaEnAlta = z
  .array(z.string())
  .optional()
  .transform((canales) => filtrarCanales(canales ?? []));

/** Edición: sin el campo la edición no toca las publicaciones existentes. */
const publicadaEnEdicion = z.array(z.string()).transform(filtrarCanales).optional();

/**
 * Schema de creación de producto. Vive acá para que el alta masiva use la
 * misma regla por fila que el alta individual.
 * `categoryId` es opcional y nullable (H2): sin categoría elegida queda en null.
 * Note: stock is no longer on Product; it lives in BranchInventory per branch.
 */
const productFields = {
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  description: z.string().max(500, "La descripción es muy larga").optional(),
  prefix: z.string().regex(/^[A-Za-z]{2,4}$/, "Prefijo: 2-4 letras (A-Z)").transform(v => v.toUpperCase()),
  price: z.number().min(0, "El precio no puede ser negativo"),
  categoryId: z.number().int().positive("Categoría inválida").nullable().optional(),
  // Estilos: la misma taxonomía que la prenda y opcional. Un id repetido no
  // aporta nada, así que se descarta en vez de fallar.
  estilos: z
    .array(z.number().int().positive("Estilo inválido"))
    .optional()
    .transform((ids) => [...new Set(ids ?? [])]),
};

/**
 * Alta individual (T3 de `talles-y-compra-alta.md`): gana sucursal, cantidad
 * inicial y costo, todos opcionales. Sin ellos el alta queda exactamente como
 * antes. Con cantidad ≥ 1 y sucursal se crea el inventario y su `ENTRY`; con
 * costo > 0 además la compra del alta, que ya no necesita sucursal: la cantidad
 * cargada es la que da las unidades de la compra.
 */
export const createProductSchema = z
  .object({
    ...productFields,
    branchId: z.number().int().positive("Sucursal inválida").optional(),
    cantidadInicial: z
      .number()
      .int("La cantidad inicial debe ser un número entero")
      .min(0, "La cantidad inicial no puede ser negativa")
      .max(999, "La cantidad inicial no puede superar 999")
      .optional(),
    costoUnitario: z.number().min(0, "El costo no puede ser negativo").optional(),
    publicadaEn: publicadaEnAlta,
  })
  .superRefine((data, ctx) => {
    if ((data.costoUnitario ?? 0) <= 0) return;
    if ((data.cantidadInicial ?? 0) < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Para registrar el costo cargá la cantidad inicial (1 o más)",
        path: ["cantidadInicial"],
      });
    }
  });

/**
 * Fila del alta masiva: la misma regla que el alta individual (que ya trae la
 * categoría de esa fila, opcional, S4) más su stock inicial (S2/S11), que sin
 * valor se trata como 0, y su costo (T4), que sin valor tampoco compra nada.
 */
const createProductsBatchRowSchema = z.object({
  ...productFields,
  initialStock: z.number().int().min(0, "El stock no puede ser negativo").optional(),
  costo: z.number().min(0, "El costo no puede ser negativo").optional(),
});

/**
 * Schema de alta masiva. La categoría es de cada fila (S4), así que el lote no
 * lleva ninguna. El nombre repetido dentro del lote se marca en la fila
 * repetida; el choque con un nombre que ya existe se valida en el servidor,
 * contra los productos activos (S3).
 *
 * `branchId` es opcional a propósito: es la sucursal global del lote (D8). Sin
 * sucursal el lote crea igual los productos y su compra (sin stock).
 */
export const createProductsBatchSchema = z
  .object({
    branchId: z.number().int().positive("Sucursal inválida").optional(),
    rows: z
      .array(createProductsBatchRowSchema)
      .min(1, "Agregá al menos un producto")
      .max(50, "Máximo 50 productos por carga"),
  })
  .superRefine((data, ctx) => {
    const vistos = new Set<string>();
    data.rows.forEach((row, rowIndex) => {
      const clave = row.name.trim().toLowerCase();
      if (vistos.has(clave)) {
        ctx.addIssue({
          code: "custom",
          message: "Nombre repetido en el lote",
          path: ["rows", rowIndex, "name"],
        });
        return;
      }
      vistos.add(clave);
    });

    // Sin sucursal no hay stock, así que la cantidad de la fila es la única
    // fuente de unidades de la compra: sin ella el costo se perdería.
    if (data.branchId !== undefined) return;
    data.rows.forEach((row, rowIndex) => {
      if ((row.costo ?? 0) > 0 && (row.initialStock ?? 0) < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Para registrar el costo cargá el stock inicial de esa fila (1 o más)",
          path: ["rows", rowIndex, "initialStock"],
        });
      }
    });
  });

export type CreateProductsBatchValues = z.infer<typeof createProductsBatchSchema>;

/**
 * Schema extendido para actualización de producto.
 *
 * NO reemplaza el `updateProductSchema` inline en `src/app/actions/product.ts`
 * (que permanece sin `categoryId`/`active` para no romper callers actuales).
 * Esta versión expone los campos nuevos de Fase 3 (categoria + toggle activo)
 * para ser usada por `updateProductExtended` y el `ProductForm` ampliado.
 *
 * `code` y `codePrefix` siguen siendo inmutables tras la creación (no incluidos).
 */
export const updateProductExtendedSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0, "El precio no puede ser negativo").optional(),
  categoryId: z.number().int().positive("Categoría inválida").nullable().optional(),
  active: z.boolean().optional(),
  // Presente = reemplaza las publicaciones; ausente = no las toca.
  publicadaEn: publicadaEnEdicion,
  // Presente = reemplaza los estilos; ausente = no los toca (misma regla).
  estilos: z
    .array(z.number().int().positive("Estilo inválido"))
    .transform((ids) => [...new Set(ids)])
    .optional(),
});

export type UpdateProductExtendedValues = z.infer<typeof updateProductExtendedSchema>;
