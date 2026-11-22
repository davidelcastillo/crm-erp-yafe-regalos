// src/lib/label-chica-layout.ts
/**
 * Geometría de la **etiqueta del peluche** (modelo del dueño): vertical, con
 * agujero troquelado arriba, frutilla, «Polkalina's», la línea **Código** y el
 * `$` con el importe. Reemplaza a la etiqueta apaisada de 21 × 23,5 mm, que no
 * tenía lugar para el código.
 *
 * Hoja **A4 vertical** (210 × 297 mm) con grilla de **6 columnas × 6 filas = 36
 * etiquetas**: cada celda es la etiqueta de 30 × 45 mm más un canal de 2 mm
 * (1 mm por lado) para pasar el cutter, y la grilla se centra. Las etiquetas se
 * llenan **fila por fila**, de izquierda a derecha y después abajo.
 *
 * Módulo puro (sin pdf-lib), igual que `label-layout` y `label-prenda-layout`.
 */

import { PDF_BRAND_COLOR } from './pdf-brand';

// --- Hoja y grilla --------------------------------------------------------
export const CHICA_SHEET_WIDTH_MM = 210;
export const CHICA_SHEET_HEIGHT_MM = 297;
export const CHICA_COLS_PER_SHEET = 6;
export const CHICA_ROWS_PER_SHEET = 6;
export const CHICA_LABELS_PER_SHEET = CHICA_COLS_PER_SHEET * CHICA_ROWS_PER_SHEET; // 36
/** Paso de la grilla: lo que ocupa cada etiqueta, incluido su canal. */
export const CHICA_CELL_WIDTH_MM = 32; // 30 + canal
export const CHICA_CELL_HEIGHT_MM = 47; // 45 + canal

// --- Etiqueta y canal -----------------------------------------------------
export const CHICA_LABEL_WIDTH_MM = 30;
export const CHICA_LABEL_HEIGHT_MM = 45;
/** Canal de corte: el resto de la celda, mitad de cada lado. */
export const CHICA_LABEL_INSET_X_MM = (CHICA_CELL_WIDTH_MM - CHICA_LABEL_WIDTH_MM) / 2;
export const CHICA_LABEL_INSET_Y_MM = (CHICA_CELL_HEIGHT_MM - CHICA_LABEL_HEIGHT_MM) / 2;
/** Aire entre el borde de la hoja y la primera etiqueta. */
export const CHICA_MARGIN_X_MM =
  (CHICA_SHEET_WIDTH_MM - CHICA_COLS_PER_SHEET * CHICA_CELL_WIDTH_MM) / 2; // 9
export const CHICA_MARGIN_Y_MM =
  (CHICA_SHEET_HEIGHT_MM - CHICA_ROWS_PER_SHEET * CHICA_CELL_HEIGHT_MM) / 2; // 7,5

// --- Colores (paleta de la marca) ----------------------------------------
export const CHICA_LABEL_BACKGROUND_COLOR = PDF_BRAND_COLOR.cream;
/** Borde redondeado cacao, como la etiqueta de prenda. */
export const CHICA_LABEL_BORDER_COLOR = PDF_BRAND_COLOR.cacao;
/** Agujero troquelado: aro rosa de la marca. */
export const CHICA_HOLE_COLOR = PDF_BRAND_COLOR.pink;
export const CHICA_TEXT_COLOR = PDF_BRAND_COLOR.cacao;
/** Importe: frutilla, el cuarto color de la marca. */
export const CHICA_PRICE_TEXT_COLOR = PDF_BRAND_COLOR.strawberry;

// --- Contenido, de arriba abajo ------------------------------------------
export const CHICA_BORDER_WIDTH_MM = 0.4;
export const CHICA_CORNER_RADIUS_MM = 3;

/** Agujero troquelado, medido desde el borde superior de la etiqueta. */
export const CHICA_HOLE_CENTER_TOP_MM = 6.5;
export const CHICA_HOLE_RADIUS_MM = 2;
export const CHICA_HOLE_BORDER_WIDTH_MM = 0.5;

/** Frutilla vectorial, arriba y centrada. */
export const CHICA_LOGO_TOP_MM = 11;
export const CHICA_LOGO_SIZE_MM = 11;

/** «Polkalina's» debajo de la frutilla. */
export const CHICA_BRAND_TOP_MM = 24;
export const CHICA_BRAND_FONT_SIZE_PT = 12;
export const CHICA_BRAND_MAX_WIDTH_MM = 24;

/** Línea del código: vuelve porque en vertical hay alto para ella. */
export const CHICA_CODE_PREFIX = 'Código: ';
export const CHICA_CODE_TOP_MM = 30;
export const CHICA_CODE_FONT_SIZE_PT = 9;

/** `$` e importe al pie. */
export const CHICA_PRICE_TOP_MM = 36;
export const CHICA_PRICE_FONT_SIZE_PT = 16;
/** Ancho útil: la etiqueta menos 3 mm de margen a cada lado. */
export const CHICA_PRICE_MAX_WIDTH_MM = 24;

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

/** Cantidad de hojas necesarias para `total` etiquetas del peluche. */
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
      x: CHICA_MARGIN_X_MM + CHICA_LABEL_INSET_X_MM + column * CHICA_CELL_WIDTH_MM,
      y: CHICA_MARGIN_Y_MM + CHICA_LABEL_INSET_Y_MM + row * CHICA_CELL_HEIGHT_MM,
    });
  }

  return slots;
}
