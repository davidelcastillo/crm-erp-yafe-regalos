// src/lib/validations/prendaTaxonomy.ts
import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es requerido")
  .max(100, "Máximo 100 caracteres");

export const createTaxonomySchema = z.object({ name: nameSchema });

export const createCategoriaPrendaSchema = createTaxonomySchema.extend({
  esUnicaPorDefecto: z.boolean().optional(),
  // Prefijo del código de las prendas de esta categoría (U8). Se normaliza a
  // mayúsculas; 2-4 letras como exige el generador (`getNextCode`).
  codePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, "El prefijo debe tener entre 2 y 4 letras")
    .optional(),
});

export const renameTaxonomySchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: nameSchema,
});

export const setTaxonomyActiveSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  active: z.boolean(),
});

export type CreateTaxonomyValues = z.infer<typeof createTaxonomySchema>;
export type RenameTaxonomyValues = z.infer<typeof renameTaxonomySchema>;
export type SetTaxonomyActiveValues = z.infer<typeof setTaxonomyActiveSchema>;

/** Proyección mínima para selectores. */
export type TaxonomyOption = { id: number; name: string };

/** Categoría de prenda: además precarga el `esUnica` del formulario. */
export type CategoriaPrendaOption = TaxonomyOption & {
  esUnicaPorDefecto: boolean;
  codePrefix: string | null;
};
