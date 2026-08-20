// src/lib/validations/export.ts
import { z } from "zod";

export const exportInventorySchema = z.object({
  branchId: z.number().int().positive("La sucursal es inválida"),
  selectedProductIds: z
    .array(z.number().int().positive("ID de producto inválido"))
    .min(1, "Seleccioná al menos un producto"),
});

export type ExportInventoryValues = z.infer<typeof exportInventorySchema>;
