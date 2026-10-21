// src/lib/label-layout.test.ts
import {
  CODE_TEXT_COLOR,
  PRICE_TEXT_COLOR,
  BOX_COLOR,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_BOX_HEIGHT_MM,
  CODE_BOX_RADIUS_MM,
  CODE_BOX_TOP_MM,
  CODE_MAX_WIDTH_RATIO,
  COLS_PER_SHEET,
  CUT_LINE_COLOR,
  CUT_LINE_WIDTH_MM,
  DOLLAR_INSET_MM,
  HANDLE_MAX_WIDTH_RATIO,
  HANDLE_TEXT,
  HANDLE_TOP_MM,
  LABELS_PER_SHEET,
  LABEL_BACKGROUND_COLOR,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  PRICE_BOX_HEIGHT_MM,
  PRICE_BOX_RADIUS_MM,
  PRICE_BOX_TOP_MM,
  ROWS_PER_SHEET,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  TEXT_COLOR,
  calculateLabelSlots,
  calculateSheetCount,
  formatPrice,
} from './label-layout';

describe('label-layout.ts — hoja A4 horizontal 9 × 8 (S6)', () => {
  test('la hoja es A4 horizontal y la grilla entra exacta', () => {
    expect(SHEET_WIDTH_MM).toBe(297);
    expect(SHEET_HEIGHT_MM).toBe(210);
    expect(COLS_PER_SHEET).toBe(9);
    expect(ROWS_PER_SHEET).toBe(8);
    expect(LABELS_PER_SHEET).toBe(72);
    expect(LABEL_WIDTH_MM).toBe(33);
    expect(LABEL_HEIGHT_MM).toBe(26.25);
    // Sin márgenes: 9 × 33 = 297 y 8 × 26,25 = 210.
    expect(COLS_PER_SHEET * LABEL_WIDTH_MM).toBe(SHEET_WIDTH_MM);
    expect(ROWS_PER_SHEET * LABEL_HEIGHT_MM).toBe(SHEET_HEIGHT_MM);
  });

  test('calculateSheetCount cuenta hojas de 72 etiquetas', () => {
    expect(calculateSheetCount(0)).toBe(0);
    expect(calculateSheetCount(1)).toBe(1);
    expect(calculateSheetCount(72)).toBe(1);
    expect(calculateSheetCount(73)).toBe(2);
    expect(calculateSheetCount(144)).toBe(2);
    expect(calculateSheetCount(145)).toBe(3);
  });
});

describe('label-layout.ts — posiciones', () => {
  test('72 etiquetas = una hoja; 73 = dos hojas', () => {
    expect(calculateLabelSlots(72)).toHaveLength(72);
    expect(new Set(calculateLabelSlots(72).map((s) => s.page))).toEqual(new Set([0]));

    const conSobrante = calculateLabelSlots(73);
    expect(conSobrante).toHaveLength(73);
    expect(conSobrante[71].page).toBe(0);
    expect(conSobrante[72]).toMatchObject({ page: 1, column: 0, row: 0, x: 0, y: 0 });
  });

  test('llena columna por columna: de arriba abajo y después la columna siguiente', () => {
    const slots = calculateLabelSlots(73);

    // Los primeros 8 van en la columna 0, filas 0-7.
    for (let row = 0; row < ROWS_PER_SHEET; row++) {
      expect(slots[row]).toMatchObject({ column: 0, row, x: 0, y: row * LABEL_HEIGHT_MM });
    }
    // La novena etiqueta abre la columna 1.
    expect(slots[8]).toMatchObject({ column: 1, row: 0, x: LABEL_WIDTH_MM, y: 0 });
    // La 17ª abre la columna 2 y la hoja 2 arranca de nuevo en (0, 0).
    expect(slots[16]).toMatchObject({ column: 2, row: 0 });
    expect(slots[72]).toMatchObject({ page: 1, column: 0, row: 0 });
  });

  test('ninguna etiqueta se sale de la hoja', () => {
    for (const slot of calculateLabelSlots(72)) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + LABEL_WIDTH_MM).toBeLessThanOrEqual(SHEET_WIDTH_MM + 1e-9);
      expect(slot.y + LABEL_HEIGHT_MM).toBeLessThanOrEqual(SHEET_HEIGHT_MM + 1e-9);
    }
  });
});

describe('label-layout.ts — medidas y colores de la plantilla (§S3)', () => {
  test('usa los colores exactos medidos', () => {
    expect(LABEL_BACKGROUND_COLOR).toBe('#fcd2d3');
    expect(BOX_COLOR).toBe('#ffeff3');
    expect(TEXT_COLOR).toBe('#6b2b43');
    expect(CUT_LINE_COLOR).toBe('#000000');
  });

  test('respeta la geometría de cajas y líneas de corte', () => {
    expect(CUT_LINE_WIDTH_MM).toBe(0.6);
    // Caja del código: 81 % del ancho de la celda, centrada.
    expect(BOX_WIDTH_MM).toBe(26.7);
    expect(BOX_LEFT_MM).toBeCloseTo((LABEL_WIDTH_MM - BOX_WIDTH_MM) / 2, 6);
    expect(CODE_BOX_TOP_MM).toBe(1);
    expect(CODE_BOX_HEIGHT_MM).toBe(6.9);
    expect(CODE_BOX_RADIUS_MM).toBe(2.7);
    expect(CODE_MAX_WIDTH_RATIO).toBe(0.9);
    // Texto: el tono de marca es de la plantilla; código e importe van aparte
    // (L12: el usuario pidió el código más oscuro y el precio en negro).
    expect(TEXT_COLOR).toBe('#6b2b43');
    expect(CODE_TEXT_COLOR).toBe('#222222');
    expect(PRICE_TEXT_COLOR).toBe('#000000');

    // Caja del precio: alto 44,5 % y arranca a 9 mm del borde superior, o sea
    // 1,1 mm después del pie de la caja del código (top medido en la plantilla).
    expect(PRICE_BOX_TOP_MM).toBe(9);
    expect(PRICE_BOX_HEIGHT_MM).toBe(11.7);
    expect(PRICE_BOX_RADIUS_MM).toBe(3.4);
    // El precio no debe invadir la caja del código ni el pie de la etiqueta.
    expect(CODE_BOX_TOP_MM + CODE_BOX_HEIGHT_MM).toBeLessThanOrEqual(PRICE_BOX_TOP_MM);
    expect(PRICE_BOX_TOP_MM + PRICE_BOX_HEIGHT_MM).toBeLessThanOrEqual(LABEL_HEIGHT_MM);
  });

  test('deja el $, el handle y su lugar en la etiqueta', () => {
    expect(DOLLAR_INSET_MM).toBe(1.7);
    expect(HANDLE_TEXT).toBe('@feria_conexx');
    expect(HANDLE_TOP_MM).toBe(PRICE_BOX_TOP_MM + PRICE_BOX_HEIGHT_MM);
    expect(HANDLE_MAX_WIDTH_RATIO).toBe(0.88);
  });
});

describe('formatPrice', () => {
  test('formatea en es-AR con dos decimales y sin símbolo', () => {
    expect(formatPrice(1250)).toBe('1.250,00');
    expect(formatPrice(99.5)).toBe('99,50');
  });
});
