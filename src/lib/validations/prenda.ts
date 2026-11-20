// src/lib/validations/prenda.ts
import { z } from "zod";

/**
 * Alta y edición de prenda (U3). La prenda es un `Product` con `kind=PRENDA`
 * más una ficha 1:1 (`PrendaDetalle`): acá vive solo la forma de lo que entra
 * por el servidor; la existencia/actividad de cada taxonomía se verifica contra
 * la base dentro de la acción.
 */

/** Canales que ofrece «Publicar en» (S7). El sistema no publica en ninguno. */
export const CANALES_PUBLICACION = ["Web", "Instagram", "WhatsApp"] as const;
export type CanalPublicacion = (typeof CANALES_PUBLICACION)[number];

const idRequerido = (mensaje: string) => z.number().int().positive(mensaje);

/** Texto opcional: se recorta y el vacío queda como `undefined`. */
const textoOpcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .transform((valor) => (valor ? valor : undefined));

const medidaSchema = z.object({
  medidaTipoId: idRequerido("Tipo de medida inválido"),
  valorCm: z
    .number({ message: "La medida debe ser un número" })
    .min(0, "La medida no puede ser negativa")
    .max(300, "La medida máxima es 300 cm")
    .multipleOf(0.1, "Hasta 1 decimal"),
});

/** Lo que comparten el alta y la edición: todo menos el stock y el código. */
const camposPrenda = {
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres"),
  descripcion: z.string().trim().max(500, "La descripción es muy larga").optional(),
  precio: z
    .number({ message: "El precio debe ser un número" })
    .positive("El precio debe ser mayor a 0"),
  costo: z
    .number({ message: "El costo debe ser un número" })
    .min(0, "El costo no puede ser negativo"),
  categoriaPrendaId: idRequerido("Categoría de prenda inválida"),
  talle: z
    .string()
    .trim()
    .min(1, "El talle es requerido")
    .max(20, "Máximo 20 caracteres"),
  condicionId: idRequerido("Condición inválida"),
  detalleCondicion: textoOpcional(200, "Máximo 200 caracteres"),
  detalleIntervencion: textoOpcional(200, "Máximo 200 caracteres"),
  // Un estilo repetido no aporta nada: se descarta en vez de fallar.
  estilos: z
    .array(idRequerido("Estilo inválido"))
    .optional()
    .transform((ids) => [...new Set(ids ?? [])]),
  medidas: z.array(medidaSchema).optional().transform((filas) => filas ?? []),
  esUnica: z.boolean(),
  // Vacío o desconocido se ignora: `PrendaPublicacion` es un registro simple.
  publicadaEn: z
    .array(z.string())
    .optional()
    .transform((canales) => [
      ...new Set(
        (canales ?? [])
          .map((canal) => canal.trim())
          .filter((canal): canal is CanalPublicacion =>
            (CANALES_PUBLICACION as readonly string[]).includes(canal)
          )
      ),
    ]),
};

const cantidadSchema = z
  .number({ message: "La cantidad debe ser un número" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1")
  .max(999, "Máximo 999 unidades");

/**
 * Alta. La sucursal es obligatoria (C5: el mockup no la muestra, el modelo la
 * necesita) y la cantidad de una prenda única es siempre 1.
 */
export const createPrendaSchema = z
  .object({
    ...camposPrenda,
    branchId: idRequerido("Sucursal inválida"),
    cantidad: cantidadSchema,
  })
  .superRefine((data, ctx) => {
    if (data.esUnica && data.cantidad !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["cantidad"],
        message: "Una prenda única lleva cantidad 1",
      });
    }
  });

/** Edición: los mismos campos, sin stock ni sucursal (S20). */
export const updatePrendaSchema = z.object({
  id: idRequerido("ID inválido"),
  ...camposPrenda,
});

export type CreatePrendaValues = z.infer<typeof createPrendaSchema>;
export type UpdatePrendaValues = z.infer<typeof updatePrendaSchema>;

/** Ficha editable que consume el formulario (la del alta y la de la edición). */
export type PrendaEditable = {
  id: number;
  code: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoriaPrendaId: number;
  condicionId: number;
  talle: string;
  detalleCondicion: string;
  detalleIntervencion: string;
  costo: number;
  esUnica: boolean;
  estilos: number[];
  medidas: Array<{ medidaTipoId: number; valorCm: number }>;
  publicadaEn: string[];
};
