// src/lib/fonts/document-fonts.ts
import type { PDFDocument, PDFFont } from 'pdf-lib';

/**
 * Escala tipográfica de los PDF de documento (inventario y comprobantes de
 * stock), en puntos.
 *
 * Se mantiene una escala y no todo a 12 pt porque el documento necesita
 * jerarquía y espacio: el título identifica la sucursal o el comprobante, los
 * encabezados de columna deben entrar en columnas de ancho fijo (a 12 pt
 * «Diferencia» mide 62,4 pt y no cabe en los 56 disponibles) y el pie queda en
 * el mínimo legible.
 */
export const DOCUMENT_FONT_SIZE = {
  /** Título del documento (nombre de sucursal o tipo de comprobante). */
  title: 15,
  /** Contenido: filas de la tabla, líneas de detalle y totales. */
  body: 12,
  /** Encabezados de columna, metadatos y notas de la cabecera. */
  label: 10,
  /** Pie «Página X de Y». */
  footer: 9,
} as const;

/** Poppins embebida, lista para `drawText`. */
export interface DocumentFonts {
  /** Poppins Regular: contenido y metadatos. */
  font: PDFFont;
  /** Poppins SemiBold: títulos, encabezados de columna y totales. */
  bold: PDFFont;
}

/** Decodifica base64 sin `Buffer`: estos módulos también corren en el navegador. */
const decodeBase64 = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

/**
 * Embebe Poppins Regular y SemiBold tomándolas del bundle (nada de `fs`: los
 * generadores se importan dinámicamente desde el navegador).
 *
 * fontkit (200 KB) y los dos TTF en base64 (400 KB) se cargan **acá y no arriba**:n * importarlos en el módulo hacía que cualquier archivo que importe un generador
 * de PDF —por ejemplo `actions/inventory.ts`— pague ese peso y, además, falle en
 * entornos sin `TextEncoder` (fontkit lo pide al cargarse, y el entorno `node` de
 * Jest no lo expone), que es exactamente lo que rompió `inventory.advanced.test.ts`.
 */
export async function embedDocumentFonts(doc: PDFDocument): Promise<DocumentFonts> {
  // fontkit 2.0.4 no publica tipos y es ESM sin export default: se usa el espacio
  // de nombres (o su `default`) porque es lo que `registerFontkit` espera (`create`).
  // @ts-expect-error -- fontkit 2.0.4 no publica tipos
  const fontkit = await import('fontkit');
  const { POPPINS_REGULAR_BASE64, POPPINS_SEMIBOLD_BASE64 } = await import('./poppins');

  // pdf-lib delega el parseo del TTF en fontkit; sin registrarlo solo acepta StandardFonts.
  doc.registerFontkit((fontkit as { default?: unknown }).default ?? fontkit);
  const font = await doc.embedFont(decodeBase64(POPPINS_REGULAR_BASE64));
  const bold = await doc.embedFont(decodeBase64(POPPINS_SEMIBOLD_BASE64));
  return { font, bold };
}
