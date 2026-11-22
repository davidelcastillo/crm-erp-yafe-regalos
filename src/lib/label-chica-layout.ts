// src/lib/label-chica-layout.ts
/**
 * Geometría de la **etiqueta chica**, la del peluche: misma hoja A4 horizontal
 * de la etiqueta de producto, pero más angosta (21 × 23,5 mm contra 30 × 23,5)
 * para que el sticker entre en la panza del peluche.
 *
 * Hoja A4 horizontal (297 × 210 mm) con grilla de **12 columnas × 8 filas = 96
 * etiquetas**; la grilla entra exacta (12 × 24,75 = 297 y 8 × 26,25 = 210) y la
 * etiqueta queda centrada en su celda, con el resto como canal de corte.
 *
 * Contenido: frutilla, «Polkalina's» y `$ precio`. **No lleva código**: con este
 * ancho el alto lo toman la marca y la caja del precio (11 + 10 = 21 de los 23,5
 * mm), y el aire que sobra no alcanza para una línea de código legible. El
 * código sigue en la etiqueta de producto y en el sistema.
 *
 * Módulo puro (sin pdf-lib), igual que `label-layout` y `label-prenda-layout`.
 */

import { PDF_BRAND_COLOR } from './pdf-brand';

// --- Hoja y grilla --------------------------------------------------------
export const CHICA_COLS_PER_SHEET = 12;
export const CHICA_ROWS_PER_SHEET = 8;
export const CHICA_LABELS_PER_SHEET = CHICA_COLS_PER_SHEET * CHICA_ROWS_PER_SHEET; // 96
/** Paso de la grilla: lo que ocupa cada etiqueta, incluido su canal. */
export const CHICA_CELL_WIDTH_MM = 24.75;
export const CHICA_CELL_HEIGHT_MM = 26.25;

// --- Etiqueta y canal -----------------------------------------------------
export const CHICA_LABEL_WIDTH_MM = 21;
export const CHICA_LABEL_HEIGHT_MM = 23.5;
/** Canal de corte: el resto de la celda, mitad de cada lado. */
export const CHICA_GUTTER_X_MM = CHICA_CELL_WIDTH_MM - CHICA_LABEL_WIDTH_MM;
export const CHICA_GUTTER_Y_MM = CHICA_CELL_HEIGHT_MM - CHICA_LABEL_HEIGHT_MM;
export const CHICA_LABEL_INSET_X_MM = CHICA_GUTTER_X_MM / 2;
export const CHICA_LABEL_INSET_Y_MM = CHICA_GUTTER_Y_MM / 2;

// --- Colores (paleta de la marca) ----------------------------------------
export const CHICA_LABEL_BACKGROUND_COLOR = PDF_BRAND_COLOR.cream;
export const CHICA_PRICE_BOX_COLOR = PDF_BRAND_COLOR.pinkSoft;
export const CHICA_TEXT_COLOR = PDF_BRAND_COLOR.cacao;
export const CHICA_PRICE_TEXT_COLOR = PDF_BRAND_COLOR.cacao;

// --- Contenido, de arriba abajo ------------------------------------------
/** Frutilla vectorial, arriba y centrada. */
export const CHICA_LOGO_TOP_MM = 1;
export const CHICA_LOGO_SIZE_MM = 5.5;
/** «Polkalina's» debajo de la frutilla. */
export const CHICA_BRAND_TOP_MM = 7;
export const CHICA_BRAND_FONT_SIZE_PT = 8;
export const CHICA_BRAND_MAX_WIDTH_MM = 17;

/** Caja del precio, centrada: el ancho lo deja el margen lateral. */
export const CHICA_PRICE_BOX_TOP_MM = 11;
export const CHICA_PRICE_BOX_HEIGHT_MM = 10;
export const CHICA_PRICE_BOX_INSET_MM = 1.25;
export const CHICA_PRICE_BOX_WIDTH_MM = CHICA_LABEL_WIDTH_MM - 2 * CHICA_PRICE_BOX_INSET_MM;
export const CHICA_PRICE_BOX_RADIUS_MM = 2.5;

/** `$` e importe dentro de la caja (el importe se achica y, si no entra, se parte). */
export const CHICA_DOLLAR_FONT_SIZE_PT = 12;
export const CHICA_DOLLAR_INSET_MM = 1.1;
export const CHICA_PRICE_GAP_MM = 0.5;
export const CHICA_PRICE_FONT_SIZE_PT = 14;
export const CHICA_PRICE_MIN_FONT_SIZE_PT = 7;

/** Esquina superior izquierda de una etiqueta dentro de su hoja. */
export interface ChicaLabelSlot {
  /** Índice global de la etiqueta (0..total-1). */
  index: number;
  /** Hoja (0-based). */
  page: number;
  column: number;
  row: number;
  /** mm desde el borde izquierdo de la hoja. */
  x: number;
  /** mm desde el borde superior de la hoja. */
  y: number;
}

/** Cantidad de hojas necesarias para `total` etiquetas chicas. */
export function calculateChicaSheetCount(total: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / CHICA_LABELS_PER_SHEET);
}

/**
 * Posiciones de las primeras `total` etiquetas, llenando fila por fila. Las de
 * la última hoja quedan al principio de la hoja.
 */
export function calculateChicaLabelSlots(total: number): ChicaLabelSlot[] {
  const slots: ChicaLabelSlot[] = [];

  for (let index = 0; index < total; index++) {
    const onPage = index % CHICA_LABELS_PER_SHEET;
    const column = onPage % CHICA_COLS_PER_SHEET;
    const row = Math.floor(onPage / CHICA_COLS_PER_SHEET);

    slots.push({
      index,
      page: Math.floor(index / CHICA_LABELS_PER_SHEET),
      column,
      row,
      x: CHICA_LABEL_INSET_X_MM + column * CHICA_CELL_WIDTH_MM,
      y: CHICA_LABEL_INSET_Y_MM + row * CHICA_CELL_HEIGHT_MM,
    });
  }

  return slots;
}
