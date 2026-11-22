// src/lib/pdf-brand.ts
/**
 * Paleta de la marca Polkalina's para todo lo que se imprime: etiquetas de
 * precio y PDF de documentos (inventario, comprobantes).
 *
 * Los hex son los tokens de `src/app/globals.css`, no colores medidos de una
 * plantilla: el día que cambie la marca se cambia acá y no en cada generador.
 * El módulo es puro (sin `pdf-lib`) porque `label-layout.ts` también corre en
 * el cliente.
 */
export const PDF_BRAND_COLOR = {
  /** `--background` / `--palette-light-surface`: fondo de la etiqueta y filas alternadas. */
  cream: '#FFF6F0',
  /** `--accent-soft` / `--palette-brand-rosa`: cajas de la etiqueta. */
  pink: '#F2C4CC',
  /** `--ink` / `--palette-near-black`: código, precio y texto de las tablas. */
  cacao: '#4A2C2A',
  /** `--ink-muted` / `--palette-secondary-gray`: metadatos y pie. */
  cacaoSoft: '#76574F',
  /** `--accent` / `--palette-brand-rosa-fuerte`: título, banda del encabezado y precio de la etiqueta. */
  strawberry: '#C8323C',
  /** `--hairline`: separador de filas y bordes. */
  border: '#EADAD6',
} as const;
