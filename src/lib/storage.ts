// src/lib/storage.ts
/**
 * Convención de las fotos de producto (ADR-08 y T1 de
 * `odd/tasks/fotos-vidriera-polkalinas.md`): bucket público para leer con una
 * URL estable y cacheable, y escritura solo por URL firmada que emite una
 * Server Action con `requireAdmin` (el service-role nunca llega al cliente).
 *
 * Una foto son DOS archivos con el mismo prefijo: `<hash>_lg.webp` para la
 * ficha y `<hash>_sm.webp` para la miniatura. Ese prefijo es lo que guarda
 * `ProductImage.path`, no una URL.
 */

/** Bucket de las fotos: declarado en `supabase/config.toml`, creado a mano en remoto. */
export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Tope de la tabla: 4 fotos por producto, la posición 0 es la portada. */
export const MAX_FOTOS = 4;

/** Tope por archivo ya comprimido en el navegador (cada tamaño por separado). */
export const MAX_BYTES_FOTO = 2 * 1024 * 1024;

export const TAMANOS_FOTO = ["lg", "sm"] as const;
export type TamanoFoto = (typeof TAMANOS_FOTO)[number];

/** Nombre del archivo de un tamaño a partir del prefijo (`hash`) que manda el cliente. */
export const nombreFoto = (hash: string, tamano: TamanoFoto) => `${hash}_${tamano}.webp`;

/** Los dos objetos de una foto, en el orden en que se firman y se borran. */
export const nombresFoto = (hash: string): string[] =>
  TAMANOS_FOTO.map((tamano) => nombreFoto(hash, tamano));

/** Primera posición libre 0..3 dadas las ocupadas, o `null` si ya hay `MAX_FOTOS`. */
export const posicionLibre = (ocupadas: readonly number[]): number | null => {
  for (let posicion = 0; posicion < MAX_FOTOS; posicion++) {
    if (!ocupadas.includes(posicion)) return posicion;
  }
  return null;
};
