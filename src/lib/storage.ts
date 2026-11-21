// src/lib/storage.ts
/**
 * Convención de las fotos de producto (ADR-08 y T1 de
 * `odd/tasks/fotos-vidriera-polkalinas.md`): bucket público para leer con una
 * URL estable y cacheable, y escritura solo por URL firmada que emite una
 * Server Action con `requireAdmin` (el service-role nunca llega al cliente).
 *
 * Una foto son DOS archivos con el mismo prefijo: `<productId>/<hash>_lg.webp`
 * para la ficha y `<productId>/<hash>_sm.webp` para la miniatura. El prefijo
 * por producto evita que dos productos con la misma imagen compartan objeto (y
 * que borrar la foto de uno se lleve la del otro). Lo que guarda
 * `ProductImage.path` es solo el `hash`, no una URL ni el path completo.
 */

/** Bucket de las fotos: declarado en `supabase/config.toml`, creado a mano en remoto. */
export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Tope de la tabla: 4 fotos por producto, la posición 0 es la portada. */
export const MAX_FOTOS = 4;

/** Tope por archivo ya comprimido en el navegador (cada tamaño por separado). */
export const MAX_BYTES_FOTO = 2 * 1024 * 1024;

/**
 * Tope del original que se acepta para comprimir. Por encima no se procesa:
 * decodificar 25 MB en un celular cuelga la pestaña.
 */
export const MAX_BYTES_ORIGEN = 25 * 1024 * 1024;

export const TAMANOS_FOTO = ["lg", "sm"] as const;
export type TamanoFoto = (typeof TAMANOS_FOTO)[number];

/** Path del archivo de un tamaño: producto + prefijo (`hash`) que manda el cliente. */
export const nombreFoto = (productId: number, hash: string, tamano: TamanoFoto) =>
  `${productId}/${hash}_${tamano}.webp`;

/** Los dos objetos de una foto, en el orden en que se firman y se borran. */
export const nombresFoto = (productId: number, hash: string): string[] =>
  TAMANOS_FOTO.map((tamano) => nombreFoto(productId, hash, tamano));

/** Primera posición libre 0..3 dadas las ocupadas, o `null` si ya hay `MAX_FOTOS`. */
export const posicionLibre = (ocupadas: readonly number[]): number | null => {
  for (let posicion = 0; posicion < MAX_FOTOS; posicion++) {
    if (!ocupadas.includes(posicion)) return posicion;
  }
  return null;
};
