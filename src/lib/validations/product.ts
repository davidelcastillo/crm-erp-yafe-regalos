// src/lib/validations/product.ts
import { z } from "zod";

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
