// src/lib/validations/category.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres"),
});

export const updateCategorySchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres")
    .optional(),
});

export const deleteCategorySchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

export interface CategoryDTO {
  id: number;
  name: string;
}

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;
export type UpdateCategoryValues = z.infer<typeof updateCategorySchema>;
