// src/lib/label-prenda-layout.ts
/**
 * Geometría de la etiqueta de prenda en sus dos medidas (modelo del dueño):
 * fondo crema con borde cacao, agujero troquelado arriba, frutilla, «Polkalina's»,
 * las líneas Código / Talle / $ y «ÚNICA» al pie.
 *
 * Hoja **A4 vertical** (210 × 297 mm):
 * - `grande`  50 × 80 mm → grilla de 3 × 3 = **9 etiquetas** por hoja.
 * - `mediana` 35 × 58 mm → grilla de 5 × 4 = **20 etiquetas** por hoja.
 *
 * Cada celda es la etiqueta más un canal de 2 mm (1 mm por lado) para cortar, y
 * la grilla se centra: los márgenes son el resto de la hoja. Las etiquetas se
 * llenan **fila por fila**, de izquierda a derecha y después abajo.
 *
 * Módulo puro (sin pdf-lib): devuelve posiciones en mm desde la esquina superior
 * izquierda y las medidas que el dibujo necesita.
 */

import { PDF_BRAND_COLOR } from './pdf-brand';

// --- Hoja -----------------------------------------------------------------
export const PRENDA_SHEET_WIDTH_MM = 210;
export const PRENDA_SHEET_HEIGHT_MM = 297;

/** Canal entre etiquetas: 1 mm de cada lado, para pasar el cutter. */
export const PRENDA_LABEL_GUTTER_MM = 2;

export type PrendaLabelSize = 'grande' | 'mediana';

/** Contenido fijo de la etiqueta. */
export const PRENDA_BRAND_TEXT = "Polkalina's";
export const PRENDA_UNICA_TEXT = 'ÚNICA';
export const PRENDA_CODE_PREFIX = 'Código: ';
export const PRENDA_TALLE_PREFIX = 'Talle: ';

// --- Colores (paleta de la marca) -----------------------------------------
export const PRENDA_LABEL_BACKGROUND_COLOR = PDF_BRAND_COLOR.cream;
export const PRENDA_LABEL_BORDER_COLOR = PDF_BRAND_COLOR.cacao;
export const PRENDA_HOLE_FILL_COLOR = PDF_BRAND_COLOR.pink;
export const PRENDA_TEXT_COLOR = PDF_BRAND_COLOR.cacao;
/** «ÚNICA» al pie: frutilla, como el modelo. */
export const PRENDA_UNICA_COLOR = PDF_BRAND_COLOR.strawberry;

export interface PrendaLabelLayout {
  size: PrendaLabelSize;
  /** Lo que mide la etiqueta dibujada. */
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  perSheet: number;
  /** Paso de la grilla: etiqueta + canal. */
  cellWidthMm: number;
  cellHeightMm: number;
  /** Aire entre el borde de la hoja y la primera etiqueta. */
  marginXMm: number;
  marginYMm: number;
  /** Borde redondeado cacao. */
  borderWidthMm: number;
  cornerRadiusMm: number;
  /** Agujero troquelado, medido desde el borde superior de la etiqueta. */
  holeCenterTopMm: number;
  holeRadiusMm: number;
  /** Frutilla vectorial, esquina superior izquierda. */
  logoTopMm: number;
  logoSizeMm: number;
  /** «Polkalina's» debajo de la frutilla. */
  brandTopMm: number;
  brandFontSizePt: number;
  brandMaxWidthMm: number;
  /** Líneas de código, talle y precio (borde superior de cada una). */
  codeTopMm: number;
  talleTopMm: number;
  priceTopMm: number;
  lineFontSizePt: number;
  priceFontSizePt: number;
  /** «ÚNICA», al pie de la etiqueta. */
  unicaTopMm: number;
  unicaFontSizePt: number;
  /** Margen lateral de las líneas de texto. */
  contentPaddingMm: number;
}

const layout = (
  size: PrendaLabelSize,
  spec: Omit<PrendaLabelLayout, 'size' | 'cellWidthMm' | 'cellHeightMm' | 'perSheet' | 'marginXMm' | 'marginYMm'>
): PrendaLabelLayout => {
  const cellWidthMm = spec.widthMm + PRENDA_LABEL_GUTTER_MM;
  const cellHeightMm = spec.heightMm + PRENDA_LABEL_GUTTER_MM;

  return {
    size,
    ...spec,
    cellWidthMm,
    cellHeightMm,
    perSheet: spec.columns * spec.rows,
    marginXMm: (PRENDA_SHEET_WIDTH_MM - spec.columns * cellWidthMm) / 2,
    marginYMm: (PRENDA_SHEET_HEIGHT_MM - spec.rows * cellHeightMm) / 2,
  };
};

export const PRENDA_LABEL_LAYOUTS: Record<PrendaLabelSize, PrendaLabelLayout> = {
  grande: layout('grande', {
    widthMm: 50,
    heightMm: 80,
    columns: 3,
    rows: 3,
    borderWidthMm: 0.5,
    cornerRadiusMm: 3.5,
    holeCenterTopMm: 6.5,
    holeRadiusMm: 2.2,
    logoTopMm: 11.5,
    logoSizeMm: 14,
    brandTopMm: 27,
    brandFontSizePt: 17,
    brandMaxWidthMm: 40,
    codeTopMm: 40,
    talleTopMm: 47,
    priceTopMm: 55,
    lineFontSizePt: 9,
    priceFontSizePt: 16,
    unicaTopMm: 68,
    unicaFontSizePt: 8,
    contentPaddingMm: 3,
  }),
  mediana: layout('mediana', {
    widthMm: 35,
    heightMm: 58,
    columns: 5,
    rows: 4,
    borderWidthMm: 0.4,
    cornerRadiusMm: 2.5,
    holeCenterTopMm: 4.8,
    holeRadiusMm: 1.6,
    logoTopMm: 8.5,
    logoSizeMm: 10,
    brandTopMm: 19.5,
    brandFontSizePt: 12,
    brandMaxWidthMm: 28,
    codeTopMm: 29,
    talleTopMm: 34.5,
    priceTopMm: 41,
    lineFontSizePt: 7,
    priceFontSizePt: 12,
    unicaTopMm: 50,
    unicaFontSizePt: 6.5,
    contentPaddingMm: 2,
  }),
};

/** Esquina superior izquierda de una etiqueta dentro de su hoja. */
export interface PrendaLabelSlot {
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

/** Cantidad de hojas necesarias para `total` etiquetas de ese tamaño. */
export function calculatePrendaSheetCount(size: PrendaLabelSize, total: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / PRENDA_LABEL_LAYOUTS[size].perSheet);
}

/**
 * Posiciones de las primeras `total` etiquetas, llenando fila por fila. Las de
 * la última hoja quedan al principio de la hoja.
 */
export function calculatePrendaLabelSlots(
  size: PrendaLabelSize,
  total: number
): PrendaLabelSlot[] {
  const { columns, perSheet, cellWidthMm, cellHeightMm, marginXMm, marginYMm } =
    PRENDA_LABEL_LAYOUTS[size];
  const slots: PrendaLabelSlot[] = [];

  for (let index = 0; index < total; index++) {
    const onPage = index % perSheet;
    const column = onPage % columns;
    const row = Math.floor(onPage / columns);

    slots.push({
      index,
      page: Math.floor(index / perSheet),
      column,
      row,
      x: marginXMm + column * cellWidthMm,
      y: marginYMm + row * cellHeightMm,
    });
  }

  return slots;
}
