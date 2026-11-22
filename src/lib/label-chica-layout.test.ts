// src/lib/label-chica-layout.test.ts
/**
 * Etiqueta chica (peluche): más angosta que la de producto, pensada para el
 * sticker del peluche. Lleva frutilla, «Polkalina's» y el precio; **no** lleva
 * código, porque a este ancho el alto de la etiqueta ya está tomado por la marca
 * y la caja del precio (ver `label-chica-layout.ts`).
 */
import {
  CHICA_BRAND_FONT_SIZE_PT,
  CHICA_BRAND_TOP_MM,
  CHICA_CELL_HEIGHT_MM,
  CHICA_CELL_WIDTH_MM,
  CHICA_COLS_PER_SHEET,
  CHICA_LABEL_HEIGHT_MM,
  CHICA_LABEL_INSET_X_MM,
  CHICA_LABEL_INSET_Y_MM,
  CHICA_LABEL_WIDTH_MM,
  CHICA_LABELS_PER_SHEET,
  CHICA_LOGO_SIZE_MM,
  CHICA_LOGO_TOP_MM,
  CHICA_PRICE_BOX_HEIGHT_MM,
  CHICA_PRICE_BOX_TOP_MM,
  CHICA_ROWS_PER_SHEET,
  calculateChicaLabelSlots,
  calculateChicaSheetCount,
} from './label-chica-layout';
import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
} from './label-layout';

describe('label-chica-layout.ts — la etiqueta del peluche', () => {
  test('es más angosta que la de producto y conserva el alto', () => {
    expect(CHICA_LABEL_WIDTH_MM).toBe(21);
    expect(CHICA_LABEL_WIDTH_MM).toBeLessThan(LABEL_WIDTH_MM);
    expect(CHICA_LABEL_HEIGHT_MM).toBe(LABEL_HEIGHT_MM);
  });

  test('la grilla entra exacta en la misma hoja A4 horizontal del producto', () => {
    expect(SHEET_WIDTH_MM).toBe(297);
    expect(SHEET_HEIGHT_MM).toBe(210);
    expect(CHICA_COLS_PER_SHEET).toBe(12);
    expect(CHICA_ROWS_PER_SHEET).toBe(8);
    expect(CHICA_LABELS_PER_SHEET).toBe(96);
    // Entra exacta como la grilla de producto: 12 × 24,75 = 297 y 8 × 26,25 = 210.
    expect(CHICA_COLS_PER_SHEET * CHICA_CELL_WIDTH_MM).toBeCloseTo(SHEET_WIDTH_MM, 6);
    expect(CHICA_ROWS_PER_SHEET * CHICA_CELL_HEIGHT_MM).toBeCloseTo(SHEET_HEIGHT_MM, 6);
  });

  test('la etiqueta es más chica que su celda: ese resto es el canal de corte', () => {
    const canalX = CHICA_CELL_WIDTH_MM - CHICA_LABEL_WIDTH_MM;
    const canalY = CHICA_CELL_HEIGHT_MM - CHICA_LABEL_HEIGHT_MM;

    expect(canalX).toBeGreaterThan(0);
    expect(canalY).toBeGreaterThan(0);
    // El canal queda mitad de cada lado: la etiqueta va centrada en su celda.
    expect(CHICA_LABEL_INSET_X_MM).toBeCloseTo(canalX / 2, 6);
    expect(CHICA_LABEL_INSET_Y_MM).toBeCloseTo(canalY / 2, 6);
  });

  test('frutilla, marca y precio entran en el alto, y no queda banda para el código', () => {
    // La frutilla y la marca se dibujan arriba de la caja del precio.
    expect(CHICA_LOGO_TOP_MM + CHICA_LOGO_SIZE_MM).toBeLessThan(CHICA_PRICE_BOX_TOP_MM);
    // La tinta de Shrikhand a 8 pt mide 0,75 em: la marca termina antes de la caja.
    const tintaMarcaMm = (CHICA_BRAND_FONT_SIZE_PT * 0.75) / (72 / 25.4);
    expect(CHICA_BRAND_TOP_MM + tintaMarcaMm).toBeLessThan(CHICA_PRICE_BOX_TOP_MM);
    // La caja del precio cierra dentro de la etiqueta, con aire abajo.
    const cierrePrecioMm = CHICA_PRICE_BOX_TOP_MM + CHICA_PRICE_BOX_HEIGHT_MM;
    expect(cierrePrecioMm).toBeLessThan(CHICA_LABEL_HEIGHT_MM);
    // El aire que sobra no alcanza para una línea de código legible: por eso no lleva.
    expect(CHICA_LABEL_HEIGHT_MM - cierrePrecioMm).toBeLessThan(3);
  });

  test('las etiquetas se llenan fila por fila y las de la última hoja quedan al principio', () => {
    const slots = calculateChicaLabelSlots(97);

    expect(slots).toHaveLength(97);
    expect(slots[0]).toMatchObject({
      index: 0,
      page: 0,
      column: 0,
      row: 0,
      x: CHICA_LABEL_INSET_X_MM,
      y: CHICA_LABEL_INSET_Y_MM,
    });
    // La columna 12 de la grilla de producto acá es la primera de la fila siguiente.
    expect(slots[CHICA_COLS_PER_SHEET]).toMatchObject({ column: 0, row: 1 });
    expect(slots[1]).toMatchObject({
      column: 1,
      row: 0,
      x: CHICA_LABEL_INSET_X_MM + CHICA_CELL_WIDTH_MM,
    });
    expect(slots[96]).toMatchObject({ page: 1, column: 0, row: 0 });
  });

  test('las hojas se cuentan por la grilla de 96', () => {
    expect(calculateChicaSheetCount(0)).toBe(0);
    expect(calculateChicaSheetCount(1)).toBe(1);
    expect(calculateChicaSheetCount(CHICA_LABELS_PER_SHEET)).toBe(1);
    expect(calculateChicaSheetCount(CHICA_LABELS_PER_SHEET + 1)).toBe(2);
  });
});
