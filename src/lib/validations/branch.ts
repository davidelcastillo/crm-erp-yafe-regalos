// src/lib/validations/branch.ts
import { z } from "zod";

export const createBranchSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre es muy largo"),
  address: z.string().max(500, "La dirección es muy larga").optional().nullable(),
  phone: z
    .string()
    .max(50, "El teléfono es muy largo")
    .optional()
    .nullable(),
  email: z
    .string()
    .email("El email es inválido")
    .max(255, "El email es muy largo")
    .optional()
    .nullable()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
  code: z
    .string()
    .regex(/^[A-Za-z0-9]{2,10}$/, "El código debe ser letras o números y entre 2 y 10 caracteres")
    .transform((value) => value.toUpperCase()),
});

export const updateBranchSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(255, "El nombre es muy largo")
    .optional(),
  address: z
    .string()
    .max(500, "La dirección es muy larga")
    .optional()
    .nullable(),
  phone: z.string().max(50, "El teléfono es muy largo").optional().nullable(),
  email: z
    .string()
    .email("El email es inválido")
    .max(255, "El email es muy largo")
    .optional()
    .nullable()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
  code: z
    .string()
    .regex(/^[A-Za-z0-9]{2,10}$/, "El código debe ser letras o números y entre 2 y 10 caracteres")
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const deleteBranchSchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

export type CreateBranchValues = z.infer<typeof createBranchSchema>;
export type UpdateBranchValues = z.infer<typeof updateBranchSchema>;
