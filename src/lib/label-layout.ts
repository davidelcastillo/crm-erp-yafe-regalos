// src/lib/label-layout.ts
/**
 * Geometría de la hoja de etiquetas de precio, medida de la plantilla del
 * usuario (`docs/PDF Precios/precios.png`, §S3 del documento ODD).
 *
 * Hoja **A4 horizontal** (297 × 210 mm) con grilla de **9 columnas × 8 filas =
 * 72 etiquetas**. La grilla entra exacta (9 × 33 = 297 y 8 × 26,25 = 210), así
 * que el canal de corte sale de **achicar la etiqueta dentro de su celda**: la
 * celda es el paso de la grilla (33 × 26,25 mm) y la etiqueta dibujada mide
 * 30 × 23,5 mm, con 3 mm de canal horizontal y 2,75 mm vertical.
 *
 * Las etiquetas se llenan **columna por columna**: de arriba abajo y después la
 * columna siguiente. Cada esquina lleva su **marca de corte** (un tick corto en
 * el canal), porque cortar a mano necesita una referencia y no un borde pegado
 * al de al lado.
 *
 * Este módulo es puro (sin pdf-lib): devuelve posiciones en mm desde la esquina
 * superior izquierda y las medidas que el dibujo necesita.
 */

/** 1 mm en puntos PostScript (72 pt = 1 pulgada). */
export const MM_TO_PT = 72 / 25.4;

// --- Hoja -----------------------------------------------------------------
export const SHEET_WIDTH_MM = 297;
export const SHEET_HEIGHT_MM = 210;

// --- Grilla ---------------------------------------------------------------
export const COLS_PER_SHEET = 9;
export const ROWS_PER_SHEET = 8;
export const LABELS_PER_SHEET = COLS_PER_SHEET * ROWS_PER_SHEET; // 72
/** Paso de la grilla: lo que ocupa cada etiqueta, incluido su canal. */
export const CELL_WIDTH_MM = 33;
export const CELL_HEIGHT_MM = 26.25;

// --- Etiqueta y canal de corte --------------------------------------------
/** Lo que se dibuja: más chico que la celda para que quede canal. */
export const LABEL_WIDTH_MM = 30;
export const LABEL_HEIGHT_MM = 23.5;
/** Canal entre etiquetas: el resto de la celda, mitad de cada lado. */
export const GUTTER_X_MM = CELL_WIDTH_MM - LABEL_WIDTH_MM; // 3
/** El canal vertical es más chico porque la etiqueta ya tenía aire abajo. */
export const GUTTER_Y_MM = CELL_HEIGHT_MM - LABEL_HEIGHT_MM; // 2,75
export const LABEL_INSET_X_MM = GUTTER_X_MM / 2; // 1,5
export const LABEL_INSET_Y_MM = GUTTER_Y_MM / 2; // 1,375

// --- Marcas de corte ------------------------------------------------------
/** Largo del tick, en mm. Más corto que medio canal para no tocar al vecino. */
export const CUT_MARK_LENGTH_MM = 1.1;
/** Separación entre el borde de la etiqueta y el tick, en mm. */
export const CUT_MARK_OFFSET_MM = 0.15;
export const CUT_MARK_WIDTH_MM = 0.2;
export const CUT_MARK_COLOR = '#000000';

// --- Colores medidos ------------------------------------------------------
/** Fondo de la etiqueta. */
export const LABEL_BACKGROUND_COLOR = '#fcd2d3';
/** Cajas del código y del precio. */
export const BOX_COLOR = '#ffeff3';
/** `$` y `@feria_conexx`: el tono de marca de la plantilla. */
export const TEXT_COLOR = '#6b2b43';
/** Código del producto: oscuro, en negrita, para que se lea de lejos (L12). */
export const CODE_TEXT_COLOR = '#222222';
/** Importe: negro pleno (L12). */
export const PRICE_TEXT_COLOR = '#000000';

// --- Caja del código (81 % del ancho, centrada) ---------------------------
export const BOX_WIDTH_MM = 26.7;
export const BOX_LEFT_MM = (LABEL_WIDTH_MM - BOX_WIDTH_MM) / 2; // 3,15
export const CODE_BOX_TOP_MM = 1;
export const CODE_BOX_HEIGHT_MM = 6.9;
export const CODE_BOX_RADIUS_MM = 2.7;
/** El código se achica si no entra en el 90 % del ancho de la caja. */
export const CODE_MAX_WIDTH_RATIO = 0.9;

// --- Caja del precio (misma caja, más alta y con más radio) ---------------
export const PRICE_BOX_TOP_MM = 9;
export const PRICE_BOX_HEIGHT_MM = 11.7;
export const PRICE_BOX_RADIUS_MM = 3.4;

// --- Contenido de la caja del precio --------------------------------------
/** Sangría del `$` desde el borde izquierdo de la caja. */
export const DOLLAR_INSET_MM = 1.7;
/** Separación entre el `$` y el importe. */
export const PRICE_GAP_MM = 0.6;
export const CURRENCY_SYMBOL = '$';

// --- Handle, justo debajo de la caja del precio ---------------------------
export const HANDLE_TEXT = '@feria_conexx';
export const HANDLE_TOP_MM = PRICE_BOX_TOP_MM + PRICE_BOX_HEIGHT_MM; // 20,7
/** Ancho máximo del handle: 88 % de la caja (23,4 mm). */
export const HANDLE_MAX_WIDTH_RATIO = 0.88;

// --- Tamaños de fuente (pt) ----------------------------------------------
export const CODE_FONT_SIZE_PT = 12;
export const PRICE_FONT_SIZE_PT = 20;
/**
 * El `$` de la plantilla mide 5,5 mm de alto visible. La cara embebida dibuja el
 * glifo a 0,89 em, así que 5,5 / 0,89 ≈ 6,18 mm ≈ 17,5 pt.
 */
export const DOLLAR_FONT_SIZE_PT = 17.5;

/** Esquina superior izquierda de una etiqueta dentro de su hoja. */
export interface LabelSlot {
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

/** Segmento de marca de corte, en mm desde la esquina superior izquierda. */
export interface CutMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Cantidad de hojas necesarias para `totalLabels` etiquetas. */
export function calculateSheetCount(totalLabels: number): number {
  if (totalLabels <= 0) return 0;
  return Math.ceil(totalLabels / LABELS_PER_SHEET);
}

/**
 * Posiciones de las primeras `totalLabels` etiquetas, llenando columna por
 * columna. Las etiquetas de la última hoja quedan en las primeras posiciones.
 */
export function calculateLabelSlots(totalLabels: number): LabelSlot[] {
  const slots: LabelSlot[] = [];

  for (let index = 0; index < totalLabels; index++) {
    const onPage = index % LABELS_PER_SHEET;
    const column = Math.floor(onPage / ROWS_PER_SHEET);
    const row = onPage % ROWS_PER_SHEET;

    slots.push({
      index,
      page: Math.floor(index / LABELS_PER_SHEET),
      column,
      row,
      x: column * CELL_WIDTH_MM + LABEL_INSET_X_MM,
      y: row * CELL_HEIGHT_MM + LABEL_INSET_Y_MM,
    });
  }

  return slots;
}

/**
 * Marcas de corte de una etiqueta: dos ticks por esquina (uno horizontal y uno
 * vertical), separados del borde para que el corte se guíe por afuera de la
 * etiqueta. Con la grilla de 9 × 8 todos los ticks caen dentro de la hoja.
 */
export function cutMarksForSlot(slot: LabelSlot): CutMark[] {
  const { x, y } = slot;
  const right = x + LABEL_WIDTH_MM;
  const bottom = y + LABEL_HEIGHT_MM;
  const gap = CUT_MARK_OFFSET_MM;
  const largo = CUT_MARK_LENGTH_MM;

  return [
    // Esquina superior izquierda.
    { x1: x - gap - largo, y1: y, x2: x - gap, y2: y },
    { x1: x, y1: y - gap - largo, x2: x, y2: y - gap },
    // Superior derecha.
    { x1: right + gap, y1: y, x2: right + gap + largo, y2: y },
    { x1: right, y1: y - gap - largo, x2: right, y2: y - gap },
    // Inferior izquierda.
    { x1: x - gap - largo, y1: bottom, x2: x - gap, y2: bottom },
    { x1: x, y1: bottom + gap, x2: x, y2: bottom + gap + largo },
    // Inferior derecha.
    { x1: right + gap, y1: bottom, x2: right + gap + largo, y2: bottom },
    { x1: right, y1: bottom + gap, x2: right, y2: bottom + gap + largo },
  ];
}

/** Importe en el estilo de la casa, sin símbolo: 1.250,00. */
export function formatPrice(price: number): string {
  return price.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
