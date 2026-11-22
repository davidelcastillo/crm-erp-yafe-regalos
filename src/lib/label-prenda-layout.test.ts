// src/lib/label-prenda-layout.test.ts
/**
 * Geometría de la etiqueta de prenda en sus dos medidas (pedido del dueño):
 * grande 50 × 80 mm y mediana 35 × 58 mm sobre A4 vertical.
 */
import {
  PRENDA_LABEL_LAYOUTS,
  PRENDA_SHEET_HEIGHT_MM,
  PRENDA_SHEET_WIDTH_MM,
  calculatePrendaLabelSlots,
  calculatePrendaSheetCount,
  type PrendaLabelSize,
} from './label-prenda-layout';
import { MM_TO_PT } from './label-layout';

const grande = PRENDA_LABEL_LAYOUTS.grande;
const mediana = PRENDA_LABEL_LAYOUTS.mediana;

describe('label-prenda-layout.ts — la hoja y las dos medidas', () => {
  test('la hoja es A4 vertical', () => {
    expect(PRENDA_SHEET_WIDTH_MM).toBe(210);
    expect(PRENDA_SHEET_HEIGHT_MM).toBe(297);
  });

  test('la etiqueta grande mide 50 × 80 mm y entran 3 × 3 = 9 por hoja', () => {
    expect(grande.widthMm).toBe(50);
    expect(grande.heightMm).toBe(80);
    expect(grande.columns).toBe(3);
    expect(grande.rows).toBe(3);
    expect(grande.perSheet).toBe(9);
    expect(grande.columns * grande.widthMm).toBeLessThanOrEqual(PRENDA_SHEET_WIDTH_MM);
    expect(grande.rows * grande.heightMm).toBeLessThanOrEqual(PRENDA_SHEET_HEIGHT_MM);
  });

  test('la etiqueta mediana mide 35 × 58 mm y entran 5 × 4 = 20 por hoja', () => {
    expect(mediana.widthMm).toBe(35);
    expect(mediana.heightMm).toBe(58);
    expect(mediana.columns).toBe(5);
    expect(mediana.rows).toBe(4);
    expect(mediana.perSheet).toBe(20);
    expect(mediana.columns * mediana.widthMm).toBeLessThanOrEqual(PRENDA_SHEET_WIDTH_MM);
    expect(mediana.rows * mediana.heightMm).toBeLessThanOrEqual(PRENDA_SHEET_HEIGHT_MM);
  });

  test('las medidas exactas en puntos (72 pt = 1 pulgada)', () => {
    expect(grande.widthMm * MM_TO_PT).toBeCloseTo(141.73, 1);
    expect(grande.heightMm * MM_TO_PT).toBeCloseTo(226.77, 1);
    expect(mediana.widthMm * MM_TO_PT).toBeCloseTo(99.21, 1);
    expect(mediana.heightMm * MM_TO_PT).toBeCloseTo(164.41, 1);
  });

  test('la grilla entra con márgenes y un canal de 2 mm separa las etiquetas', () => {
    for (const layout of [grande, mediana]) {
      expect(layout.cellWidthMm).toBeCloseTo(layout.widthMm + 2, 6);
      expect(layout.cellHeightMm).toBeCloseTo(layout.heightMm + 2, 6);
      expect(layout.marginXMm).toBeCloseTo(
        (PRENDA_SHEET_WIDTH_MM - layout.columns * layout.cellWidthMm) / 2,
        6
      );
      expect(layout.marginYMm).toBeCloseTo(
        (PRENDA_SHEET_HEIGHT_MM - layout.rows * layout.cellHeightMm) / 2,
        6
      );
      expect(layout.marginXMm).toBeGreaterThan(0);
      expect(layout.marginYMm).toBeGreaterThan(0);
    }
  });
});

describe('label-prenda-layout.ts — posiciones', () => {
  test('cuenta hojas por tamaño', () => {
    expect(calculatePrendaSheetCount('grande', 0)).toBe(0);
    expect(calculatePrendaSheetCount('grande', 9)).toBe(1);
    expect(calculatePrendaSheetCount('grande', 10)).toBe(2);
    expect(calculatePrendaSheetCount('mediana', 20)).toBe(1);
    expect(calculatePrendaSheetCount('mediana', 21)).toBe(2);
  });

  test('llena fila por fila y ninguna etiqueta se sale de la hoja', () => {
    const slots = calculatePrendaLabelSlots('mediana', 21);
    expect(slots).toHaveLength(21);
    expect(slots[0]).toMatchObject({
      page: 0,
      column: 0,
      row: 0,
      x: mediana.marginXMm,
      y: mediana.marginYMm,
    });
    expect(slots[1]).toMatchObject({ page: 0, column: 1, row: 0 });
    expect(slots[5]).toMatchObject({ page: 0, column: 0, row: 1 });
    expect(slots[20]).toMatchObject({ page: 1, column: 0, row: 0 });

    for (const size of ['grande', 'mediana'] as PrendaLabelSize[]) {
      const layout = PRENDA_LABEL_LAYOUTS[size];
      for (const slot of calculatePrendaLabelSlots(size, layout.perSheet)) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.x + layout.widthMm).toBeLessThanOrEqual(PRENDA_SHEET_WIDTH_MM + 1e-9);
        expect(slot.y + layout.heightMm).toBeLessThanOrEqual(PRENDA_SHEET_HEIGHT_MM + 1e-9);
      }
    }
  });

  test('el contenido se apila de arriba abajo: agujero, marca, líneas y pie', () => {
    for (const layout of [grande, mediana]) {
      expect(layout.holeCenterTopMm + layout.holeRadiusMm).toBeLessThan(layout.logoTopMm);
      expect(layout.logoTopMm + layout.logoSizeMm).toBeLessThanOrEqual(layout.brandTopMm);
      expect(layout.brandTopMm).toBeLessThan(layout.codeTopMm);
      expect(layout.codeTopMm).toBeLessThan(layout.talleTopMm);
      expect(layout.talleTopMm).toBeLessThan(layout.priceTopMm);
      expect(layout.priceTopMm).toBeLessThan(layout.unicaTopMm);
      expect(layout.unicaTopMm).toBeLessThan(layout.heightMm);
    }
  });
});
