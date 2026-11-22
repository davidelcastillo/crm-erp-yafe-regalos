// src/lib/label-chica-layout.test.ts
/**
 * Etiqueta del peluche (modelo del dueño): **vertical**, con agujero troquelado
 * arriba, frutilla, «Polkalina's», la línea Código y el `$` con el importe. La
 * versión anterior era apaisada (21 × 23,5 mm) y sin código; se descartó.
 */
import {
  CHICA_BRAND_FONT_SIZE_PT,
  CHICA_BRAND_MAX_WIDTH_MM,
  CHICA_BRAND_TOP_MM,
  CHICA_CELL_HEIGHT_MM,
  CHICA_CELL_WIDTH_MM,
  CHICA_CODE_TOP_MM,
  CHICA_COLS_PER_SHEET,
  CHICA_HOLE_CENTER_TOP_MM,
  CHICA_HOLE_RADIUS_MM,
  CHICA_LABEL_HEIGHT_MM,
  CHICA_LABEL_INSET_X_MM,
  CHICA_LABEL_INSET_Y_MM,
  CHICA_LABEL_WIDTH_MM,
  CHICA_LABELS_PER_SHEET,
  CHICA_LOGO_SIZE_MM,
  CHICA_LOGO_TOP_MM,
  CHICA_MARGIN_X_MM,
  CHICA_MARGIN_Y_MM,
  CHICA_PRICE_FONT_SIZE_PT,
  CHICA_PRICE_MAX_WIDTH_MM,
  CHICA_PRICE_TEXT_COLOR,
  CHICA_PRICE_TOP_MM,
  CHICA_ROWS_PER_SHEET,
  CHICA_SHEET_HEIGHT_MM,
  CHICA_SHEET_WIDTH_MM,
  CHICA_TEXT_COLOR,
  calculateChicaLabelSlots,
  calculateChicaSheetCount,
} from './label-chica-layout';

/** Alto de la tinta de Shrikhand sobre la línea base, en em (medido en el TTF). */
const HANDLE_INK_ASCENT_EM = 0.75;
const MM_TO_PT = 72 / 25.4;

describe('label-chica-layout.ts — la etiqueta del peluche', () => {
  test('es vertical de 30 × 45 mm, la proporción del modelo', () => {
    expect(CHICA_LABEL_WIDTH_MM).toBe(30);
    expect(CHICA_LABEL_HEIGHT_MM).toBe(45);
    expect(CHICA_LABEL_HEIGHT_MM).toBeGreaterThan(CHICA_LABEL_WIDTH_MM);
    // El modelo ronda 0,69 de ancho por alto; 30 / 45 = 0,667.
    expect(CHICA_LABEL_WIDTH_MM / CHICA_LABEL_HEIGHT_MM).toBeCloseTo(0.667, 2);
  });

  test('la grilla entra en una hoja A4 vertical: 6 × 6 = 36 etiquetas', () => {
    expect(CHICA_SHEET_WIDTH_MM).toBe(210);
    expect(CHICA_SHEET_HEIGHT_MM).toBe(297);
    expect(CHICA_COLS_PER_SHEET).toBe(6);
    expect(CHICA_ROWS_PER_SHEET).toBe(6);
    expect(CHICA_LABELS_PER_SHEET).toBe(36);
    // Con canal de 2 mm por celda: 6 × 32 = 192 mm de ancho y 6 × 47 = 282 de alto.
    expect(CHICA_CELL_WIDTH_MM).toBe(32);
    expect(CHICA_CELL_HEIGHT_MM).toBe(47);
    expect(CHICA_COLS_PER_SHEET * CHICA_CELL_WIDTH_MM).toBeLessThanOrEqual(
      CHICA_SHEET_WIDTH_MM
    );
    expect(CHICA_ROWS_PER_SHEET * CHICA_CELL_HEIGHT_MM).toBeLessThanOrEqual(
      CHICA_SHEET_HEIGHT_MM
    );
    // La grilla va centrada: los márgenes son el resto de la hoja.
    expect(CHICA_MARGIN_X_MM).toBeCloseTo(
      (CHICA_SHEET_WIDTH_MM - CHICA_COLS_PER_SHEET * CHICA_CELL_WIDTH_MM) / 2,
      6
    );
    expect(CHICA_MARGIN_Y_MM).toBeCloseTo(
      (CHICA_SHEET_HEIGHT_MM - CHICA_ROWS_PER_SHEET * CHICA_CELL_HEIGHT_MM) / 2,
      6
    );
  });

  test('la etiqueta es más chica que su celda: ese resto es el canal de corte', () => {
    const canalX = CHICA_CELL_WIDTH_MM - CHICA_LABEL_WIDTH_MM;
    const canalY = CHICA_CELL_HEIGHT_MM - CHICA_LABEL_HEIGHT_MM;

    // Al menos 2 mm de canal por lado, como la etiqueta de prenda.
    expect(canalX).toBeGreaterThanOrEqual(2);
    expect(canalY).toBeGreaterThanOrEqual(2);
    expect(CHICA_LABEL_INSET_X_MM).toBeCloseTo(canalX / 2, 6);
    expect(CHICA_LABEL_INSET_Y_MM).toBeCloseTo(canalY / 2, 6);
  });

  test('agujero, frutilla, marca, código y precio entran de arriba abajo', () => {
    // El agujero troquelado abre la etiqueta.
    expect(CHICA_HOLE_CENTER_TOP_MM - CHICA_HOLE_RADIUS_MM).toBeGreaterThan(0);
    expect(CHICA_HOLE_CENTER_TOP_MM + CHICA_HOLE_RADIUS_MM).toBeLessThan(
      CHICA_LOGO_TOP_MM
    );
    // Frutilla, y debajo la marca.
    expect(CHICA_LOGO_TOP_MM + CHICA_LOGO_SIZE_MM).toBeLessThan(CHICA_BRAND_TOP_MM);

    const tintaMarcaMm = (CHICA_BRAND_FONT_SIZE_PT * HANDLE_INK_ASCENT_EM) / MM_TO_PT;
    expect(CHICA_BRAND_TOP_MM + tintaMarcaMm).toBeLessThan(CHICA_CODE_TOP_MM);
    // El código vuelve: en vertical hay alto para la línea, y va antes del precio.
    expect(CHICA_CODE_TOP_MM).toBeLessThan(CHICA_PRICE_TOP_MM);
    // Y el precio cierra dentro de la etiqueta (ascendente de Helvetica: 0,718 em).
    const tintaPrecioMm = (CHICA_PRICE_FONT_SIZE_PT * 0.718) / MM_TO_PT;
    expect(CHICA_PRICE_TOP_MM + tintaPrecioMm).toBeLessThan(CHICA_LABEL_HEIGHT_MM);
  });

  test('el texto se mide contra el ancho útil, con margen a los costados', () => {
    expect(CHICA_PRICE_MAX_WIDTH_MM).toBeLessThan(CHICA_LABEL_WIDTH_MM);
    expect(CHICA_BRAND_MAX_WIDTH_MM).toBeLessThanOrEqual(CHICA_PRICE_MAX_WIDTH_MM);
    // Frutilla arriba (cacao de la marca) y precio en el frutilla de la paleta.
    expect(CHICA_TEXT_COLOR).toBe('#4A2C2A');
    expect(CHICA_PRICE_TEXT_COLOR).toBe('#C8323C');
  });

  test('las etiquetas se llenan fila por fila, dentro de la hoja', () => {
    const slots = calculateChicaLabelSlots(37);

    expect(slots).toHaveLength(37);
    expect(slots[0]).toMatchObject({
      index: 0,
      page: 0,
      column: 0,
      row: 0,
      x: CHICA_MARGIN_X_MM + CHICA_LABEL_INSET_X_MM,
      y: CHICA_MARGIN_Y_MM + CHICA_LABEL_INSET_Y_MM,
    });
    // La séptima abre la fila de abajo.
    expect(slots[CHICA_COLS_PER_SHEET]).toMatchObject({ column: 0, row: 1 });
    // La segunda sigue a la derecha dentro de la misma fila.
    expect(slots[1]).toMatchObject({
      column: 1,
      row: 0,
      x: CHICA_MARGIN_X_MM + CHICA_CELL_WIDTH_MM + CHICA_LABEL_INSET_X_MM,
    });
    // La 37ª abre la hoja 2 arriba a la izquierda.
    expect(slots[36]).toMatchObject({ page: 1, column: 0, row: 0 });

    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + CHICA_LABEL_WIDTH_MM).toBeLessThanOrEqual(CHICA_SHEET_WIDTH_MM + 1e-9);
      expect(slot.y + CHICA_LABEL_HEIGHT_MM).toBeLessThanOrEqual(
        CHICA_SHEET_HEIGHT_MM + 1e-9
      );
    }
  });

  test('las hojas se cuentan por la grilla de 36', () => {
    expect(calculateChicaSheetCount(0)).toBe(0);
    expect(calculateChicaSheetCount(1)).toBe(1);
    expect(calculateChicaSheetCount(CHICA_LABELS_PER_SHEET)).toBe(1);
    expect(calculateChicaSheetCount(CHICA_LABELS_PER_SHEET + 1)).toBe(2);
  });
});
