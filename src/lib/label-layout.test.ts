// src/lib/label-layout.test.ts
import {
  AMOUNT_MIN_FONT_SIZE_PT,
  CODE_MIN_FONT_SIZE_PT,
  CODE_TEXT_COLOR,
  BOX_BORDER_COLOR,
  BOX_BORDER_WIDTH_MM,
  PRICE_TEXT_COLOR,
  HANDLE_INK_ASCENT_EM,
  HANDLE_MAX_HEIGHT_RATIO,
  HANDLE_MIN_FONT_SIZE_PT,
  BOX_COLOR,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_BOX_HEIGHT_MM,
  CODE_BOX_RADIUS_MM,
  CODE_BOX_TOP_MM,
  CODE_MAX_WIDTH_RATIO,
  COLS_PER_SHEET,
  CUT_MARK_COLOR,
  CELL_HEIGHT_MM,
  CELL_WIDTH_MM,
  CUT_MARK_LENGTH_MM,
  CUT_MARK_OFFSET_MM,
  CUT_MARK_WIDTH_MM,
  DOLLAR_INSET_MM,
  HANDLE_MAX_WIDTH_RATIO,
  HANDLE_TEXT,
  HANDLE_TOP_MM,
  LABELS_PER_SHEET,
  LABEL_BACKGROUND_COLOR,
  LABEL_HEIGHT_MM,
  LABEL_INSET_X_MM,
  LABEL_INSET_Y_MM,
  LABEL_WIDTH_MM,
  GUTTER_X_MM,
  GUTTER_Y_MM,
  PRICE_BOX_HEIGHT_MM,
  PRICE_BOX_RADIUS_MM,
  PRICE_BOX_TOP_MM,
  ROWS_PER_SHEET,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  TEXT_COLOR,
  calculateLabelSlots,
  calculateSheetCount,
  cutMarksForSlot,
  formatPrice,
  formatPriceLines,
} from './label-layout';

/** Luminancia relativa de un hex, para medir contraste (WCAG 2.1). */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contraste entre dos hex (1 = ninguno, 21 = negro sobre blanco). */
const contrast = (a: string, b: string) => {
  const [claro, oscuro] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

describe('label-layout.ts — hoja A4 horizontal 9 × 8 (S6)', () => {
  test('la hoja es A4 horizontal y la grilla entra exacta', () => {
    expect(SHEET_WIDTH_MM).toBe(297);
    expect(SHEET_HEIGHT_MM).toBe(210);
    expect(COLS_PER_SHEET).toBe(9);
    expect(ROWS_PER_SHEET).toBe(8);
    expect(LABELS_PER_SHEET).toBe(72);
    // La celda es el paso de la grilla y entra exacta: 9 × 33 = 297 y 8 × 26,25 = 210.
    expect(CELL_WIDTH_MM).toBe(33);
    expect(CELL_HEIGHT_MM).toBe(26.25);
    expect(COLS_PER_SHEET * CELL_WIDTH_MM).toBe(SHEET_WIDTH_MM);
    expect(ROWS_PER_SHEET * CELL_HEIGHT_MM).toBe(SHEET_HEIGHT_MM);
    // La etiqueta dibujada es más chica que su celda: ese resto es el canal (S2).
    expect(LABEL_WIDTH_MM).toBe(30);
    expect(LABEL_HEIGHT_MM).toBe(23.5);
    expect(GUTTER_X_MM).toBeCloseTo(3, 6);
    expect(GUTTER_Y_MM).toBeCloseTo(2.75, 6);
    expect(LABEL_INSET_X_MM).toBeCloseTo(1.5, 6);
    expect(LABEL_INSET_Y_MM).toBeCloseTo(1.375, 6);
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
    expect(conSobrante[72]).toMatchObject({
      page: 1,
      column: 0,
      row: 0,
      x: LABEL_INSET_X_MM,
      y: LABEL_INSET_Y_MM,
    });
  });

  test('llena columna por columna: de arriba abajo y después la columna siguiente', () => {
    const slots = calculateLabelSlots(73);

    // Los primeros 8 van en la columna 0, filas 0-7.
    for (let row = 0; row < ROWS_PER_SHEET; row++) {
      expect(slots[row]).toMatchObject({
        column: 0,
        row,
        x: LABEL_INSET_X_MM,
        y: row * CELL_HEIGHT_MM + LABEL_INSET_Y_MM,
      });
    }
    // La novena etiqueta abre la columna 1.
    expect(slots[8]).toMatchObject({
      column: 1,
      row: 0,
      x: CELL_WIDTH_MM + LABEL_INSET_X_MM,
      y: LABEL_INSET_Y_MM,
    });
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

  test('las marcas de corte caen dentro de la hoja y fuera de la etiqueta', () => {
    for (const slot of calculateLabelSlots(72)) {
      const marcas = cutMarksForSlot(slot);
      // Dos ticks por esquina: uno horizontal y uno vertical.
      expect(marcas).toHaveLength(8);

      const derecha = slot.x + LABEL_WIDTH_MM;
      const abajo = slot.y + LABEL_HEIGHT_MM;

      for (const { x1, y1, x2, y2 } of marcas) {
        expect(Math.min(x1, x2)).toBeGreaterThanOrEqual(0);
        expect(Math.min(y1, y2)).toBeGreaterThanOrEqual(0);
        expect(Math.max(x1, x2)).toBeLessThanOrEqual(SHEET_WIDTH_MM + 1e-9);
        expect(Math.max(y1, y2)).toBeLessThanOrEqual(SHEET_HEIGHT_MM + 1e-9);
        // Ningún tick pisa la etiqueta.
        const fueraEnX = Math.max(x1, x2) <= slot.x + 1e-9 || Math.min(x1, x2) >= derecha - 1e-9;
        const fueraEnY = Math.max(y1, y2) <= slot.y + 1e-9 || Math.min(y1, y2) >= abajo - 1e-9;
        expect(fueraEnX || fueraEnY).toBe(true);
      }
    }
  });
});

describe('label-layout.ts — medidas y colores de la plantilla (§S3)', () => {
  test('usa solo la paleta de la marca Polkalina\'s', () => {
    // Crema de fondo, rosa de las cajas, cacao del texto y del borde, frutilla
    // del precio: los mismos tokens de la app (`globals.css`).
    expect(LABEL_BACKGROUND_COLOR).toBe('#FFF6F0');
    expect(BOX_COLOR).toBe('#F2C4CC');
    expect(BOX_BORDER_COLOR).toBe('#4A2C2A');
    expect(TEXT_COLOR).toBe('#4A2C2A');
    expect(PRICE_TEXT_COLOR).toBe('#C8323C');
    expect(CUT_MARK_COLOR).toBe('#4A2C2A');
  });

  test('respeta la geometría de cajas y las marcas de corte', () => {
    // Ticks: cortos, finos y separados del borde de la etiqueta.
    expect(CUT_MARK_WIDTH_MM).toBe(0.2);
    expect(CUT_MARK_LENGTH_MM).toBe(1.1);
    expect(CUT_MARK_OFFSET_MM).toBe(0.15);
    expect(CUT_MARK_LENGTH_MM + CUT_MARK_OFFSET_MM).toBeLessThanOrEqual(GUTTER_Y_MM / 2);
    // Caja del código: 89 % del ancho de la etiqueta, centrada.
    expect(BOX_WIDTH_MM).toBe(26.7);
    expect(BOX_LEFT_MM).toBeCloseTo((LABEL_WIDTH_MM - BOX_WIDTH_MM) / 2, 6);
    expect(CODE_BOX_TOP_MM).toBe(1);
    expect(CODE_BOX_HEIGHT_MM).toBe(6.9);
    expect(CODE_BOX_RADIUS_MM).toBe(2.7);
    expect(CODE_MAX_WIDTH_RATIO).toBe(0.9);
    // Texto: `$` y código en cacao; el importe en frutilla, el cuarto color de
    // la marca (L12 sigue cumplido: los tres se leen de lejos).
    expect(TEXT_COLOR).toBe('#4A2C2A');
    expect(CODE_TEXT_COLOR).toBe('#4A2C2A');
    expect(PRICE_TEXT_COLOR).toBe('#C8323C');
    // Las dos cajas van en el mismo rosa de la marca, con borde cacao fino.
    expect(BOX_BORDER_COLOR).toBe('#4A2C2A');
    expect(BOX_BORDER_WIDTH_MM).toBeGreaterThan(0);
    expect(BOX_BORDER_WIDTH_MM).toBeLessThanOrEqual(0.3);

    // Caja del precio: alto 44,5 % y arranca a 9 mm del borde superior, o sea
    // 1,1 mm después del pie de la caja del código (top medido en la plantilla).
    expect(PRICE_BOX_TOP_MM).toBe(9);
    expect(PRICE_BOX_HEIGHT_MM).toBe(11.7);
    expect(PRICE_BOX_RADIUS_MM).toBe(3.4);
    // El precio no debe invadir la caja del código ni el pie de la etiqueta.
    expect(CODE_BOX_TOP_MM + CODE_BOX_HEIGHT_MM).toBeLessThanOrEqual(PRICE_BOX_TOP_MM);
    expect(PRICE_BOX_TOP_MM + PRICE_BOX_HEIGHT_MM).toBeLessThanOrEqual(LABEL_HEIGHT_MM);
    // El contenido completo (hasta el pie del handle) entra en la etiqueta achicada.
    expect(HANDLE_TOP_MM).toBeLessThanOrEqual(LABEL_HEIGHT_MM);
    expect(HANDLE_TOP_MM).toBeCloseTo(20.7, 6);
  });

  test('deja el $, el handle y su lugar en la etiqueta', () => {
    expect(DOLLAR_INSET_MM).toBe(1.7);
    expect(HANDLE_TEXT).toBe("Polkalina's");
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

// L13: con textos largos nada se sale de la caja y nada baja del mínimo legible.
describe('label-layout.ts — textos largos y legibilidad', () => {
  test('deja un mínimo legible para el código, el importe y el handle', () => {
    expect(CODE_MIN_FONT_SIZE_PT).toBeGreaterThanOrEqual(8);
    expect(AMOUNT_MIN_FONT_SIZE_PT).toBeGreaterThanOrEqual(8);
    expect(HANDLE_MIN_FONT_SIZE_PT).toBeGreaterThanOrEqual(9);
    expect(HANDLE_MIN_FONT_SIZE_PT).toBeLessThanOrEqual(10);
  });

  test('el handle entra en su banda sin bajar de 9 pt', () => {
    const bandaPt = (LABEL_HEIGHT_MM - HANDLE_TOP_MM) * (72 / 25.4);
    // La tinta del handle (no su caja de línea) tiene que caber en la banda.
    expect(HANDLE_MIN_FONT_SIZE_PT * HANDLE_INK_ASCENT_EM).toBeLessThanOrEqual(
      bandaPt * HANDLE_MAX_HEIGHT_RATIO
    );
    expect(HANDLE_MAX_HEIGHT_RATIO).toBeLessThanOrEqual(1);
  });

  test('el importe va en frutilla sobre el rosa de la marca con borde cacao', () => {
    expect(PRICE_TEXT_COLOR).toBe('#C8323C');
    // Un solo rosa para las dos cajas: el rosa muy claro anterior desentonaba.
    expect(PRICE_TEXT_COLOR).not.toBe(CODE_TEXT_COLOR);
    // AAA (>= 7) del cacao sobre el rosa de las cajas y sobre el crema del fondo.
    expect(contrast(CODE_TEXT_COLOR, BOX_COLOR)).toBeGreaterThanOrEqual(7);
    expect(contrast(CODE_TEXT_COLOR, LABEL_BACKGROUND_COLOR)).toBeGreaterThanOrEqual(7);
    // El frutilla a 20 pt es texto grande: alcanza AA (>= 3) sobre su caja y AAA
    // sobre el crema, que es donde se usa.
    expect(contrast(PRICE_TEXT_COLOR, BOX_COLOR)).toBeGreaterThanOrEqual(3);
    expect(contrast(PRICE_TEXT_COLOR, LABEL_BACKGROUND_COLOR)).toBeGreaterThanOrEqual(4.5);
    // Y el borde cacao de la caja se distingue del relleno.
    expect(contrast(BOX_BORDER_COLOR, BOX_COLOR)).toBeGreaterThanOrEqual(7);
  });
});

describe('formatPriceLines', () => {
  test('parte el importe en entero y centavos sin perder el dato', () => {
    expect(formatPriceLines(299999999.99)).toEqual(['299.999.999', ',99']);
    expect(formatPriceLines(1250)).toEqual(['1.250', ',00']);
  });
});
