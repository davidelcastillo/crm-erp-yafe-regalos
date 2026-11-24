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

/** S1: filas «Talle + Variante + Cantidad»; el total de la prenda es la suma de las filas. */
const cantidadSchema = z
  .number({ message: "La cantidad debe ser un número" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1")
  .max(999, "Máximo 999 unidades");

/** Variante libre de la combinación («Color rojo»): vacía = sin variante. */
const varianteSchema = z
  .string()
  .trim()
  .max(40, "La variante es muy larga")
  .optional()
  .transform((valor) => valor ?? "");

/** Foto de la combinación: la `position` de una foto del propio producto. */
const fotoPositionSchema = z
  .number({ message: "La foto del talle es inválida" })
  .int("La foto del talle es inválida")
  .min(0, "La foto del talle es inválida")
  .max(3, "La foto del talle es inválida")
  .optional();

const talleFilaSchema = z.object({
  talle: z
    .string()
    .trim()
    .min(1, "El talle es requerido")
    .max(20, "Máximo 20 caracteres"),
  variante: varianteSchema,
  cantidad: cantidadSchema,
  fotoPosition: fotoPositionSchema,
});

const tallesSchema = z
  .array(talleFilaSchema)
  .min(1, "Cargá al menos un talle")
  // La clave de la fila es talle + variante (la misma de `PrendaTalle`):
  // repetirla duplicaría la clave, así que se rechaza en su fila.
  .superRefine((filas, ctx) => {
    const vistas = new Set<string>();
    filas.forEach((fila, indice) => {
      const clave = JSON.stringify([fila.talle, fila.variante]);
      if (vistas.has(clave)) {
        ctx.addIssue({
          code: "custom",
          message: "Talle y variante repetidos",
          path: [indice, "talle"],
        });
        return;
      }
      vistas.add(clave);
    });
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
  talles: tallesSchema,
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

/**
 * Alta. La sucursal es obligatoria (C5: el mockup no la muestra, el modelo la
 * necesita) y la cantidad total se deriva de las filas de talle (S1): una
 * prenda única lleva un solo talle, sin variante y con cantidad 1.
 */
export const createPrendaSchema = z
  .object({
    ...camposPrenda,
    branchId: idRequerido("Sucursal inválida"),
  })
  .superRefine((data, ctx) => {
    // El array vacío ya lo reporta `min(1)`: acá no se duplica.
    if (!data.esUnica || data.talles.length === 0) return;
    const cantidadTotal = data.talles.reduce((suma, fila) => suma + fila.cantidad, 0);
    // Una prenda única es una sola pieza: sin variante y con una unidad.
    if (data.talles.length !== 1 || cantidadTotal !== 1 || data.talles[0].variante !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["talles"],
        message: "Una prenda única lleva un solo talle sin variante y con cantidad 1",
      });
    }
  });

/** Edición: los mismos campos, sin stock ni sucursal (S20). */
export const updatePrendaSchema = z.object({
  id: idRequerido("ID inválido"),
  ...camposPrenda,
});

/**
 * Destacado de la portada de la tienda: el producto se elige en la ficha y la
 * acción verifica que esté activo y publicado en Web. Uno solo a la vez.
 */
export const destacarPrendaSchema = z.object({
  productId: idRequerido("Producto inválido"),
  destacado: z.boolean(),
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
  talles: Array<{
    talle: string;
    variante: string;
    cantidad: number;
    fotoPosition: number | null;
  }>;
  detalleCondicion: string;
  detalleIntervencion: string;
  costo: number;
  esUnica: boolean;
  estilos: number[];
  medidas: Array<{ medidaTipoId: number; valorCm: number }>;
  publicadaEn: string[];
  /** Destacado en la portada de la tienda (`Product.destacado`). */
  destacado: boolean;
};
