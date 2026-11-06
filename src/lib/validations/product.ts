// src/lib/validations/product.ts
import { z } from "zod";

/**
 * Schema de creación de producto. Vive acá para que el alta masiva use la
 * misma regla por fila que el alta individual.
 * Note: stock is no longer on Product; it lives in BranchInventory per branch.
 */
export const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  description: z.string().max(500, "La descripción es muy larga").optional(),
  prefix: z.string().regex(/^[A-Za-z]{2,4}$/, "Prefijo: 2-4 letras (A-Z)").transform(v => v.toUpperCase()),
  price: z.number().min(0, "El precio no puede ser negativo"),
});

/**
 * Fila del alta masiva: la misma regla que el alta individual más la
 * categoría de esa fila, opcional (S4).
 */
const createProductsBatchRowSchema = createProductSchema.extend({
  categoryId: z.number().int().positive("Categoría inválida").nullable().optional(),
});

/**
 * Schema de alta masiva. La categoría es de cada fila (S4), así que el lote no
 * lleva ninguna. El nombre repetido dentro del lote se marca en la fila
 * repetida; el choque con un nombre que ya existe se valida en el servidor,
 * contra los productos activos (S3).
 */
export const createProductsBatchSchema = z
  .object({
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
});

export type UpdateProductExtendedValues = z.infer<typeof updateProductExtendedSchema>;
