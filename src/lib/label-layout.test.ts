// src/lib/label-layout.test.ts
import { calculateLabelLayout, LabelPosition, LabelRenderingInstructions, SHEET_WIDTH_MM, SHEET_HEIGHT_MM, LABEL_WIDTH_MM, LABEL_HEIGHT_MM, LABELS_PER_SHEET } from './label-layout';

describe('label-layout.ts', () => {
  test('calculateSheetCount returns correct pages', () => {
    expect(calculateSheetCount(0)).toBe(0);
    expect(calculateSheetCount(1)).toBe(1);
    expect(calculateSheetCount(91)).toBe(1);
    expect(calculateSheetCount(92)).toBe(2);
    expect(calculateSheetCount(182)).toBe(2);
    expect(calculateSheetCount(183)).toBe(3);
  });

  test('calculateLabelLayout returns empty for no selections', () => {
    const result = calculateLabelLayout([]);
    expect(result.labels).toHaveLength(0);
    expect(result.totalPages).toBe(0);
    expect(result.totalLabels).toBe(0);
  });

  test('calculateLabelLayout calculates positions for single label', () => {
    const selections = [{ productId: 1, quantity: 1 }];
    const result = calculateLabelLayout(selections);
    expect(result.totalLabels).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.labels).toHaveLength(1);
    const label = result.labels[0];
    expect(label.position).toEqual({
      index: 0,
      page: 0,
      x: 5, // left margin
      y: 5, // top margin
      column: 0,
      row: 0,
    });
    expect(label.product).toEqual({
      id: 1,
      code: '',
      price: 0,
    });
  });

  test('calculateLabelLayout respects column-major order', () => {
    // Request 15 labels (should fill first column rows 0-12, then second column rows 0-2)
    const selections = [{ productId: 1, quantity: 15 }];
    const result = calculateLabelLayout(selections);
    expect(result.totalLabels).toBe(15);
    // First 13 labels should be in column 0, rows 0-12
    for (let i = 0; i < 13; i++) {
      expect(result.labels[i].position.column).toBe(0);
      expect(result.labels[i].position.row).toBe(i);
    }
    // Next 2 labels should be in column 1, rows 0-1
    expect(result.labels[13].position.column).toBe(1);
    expect(result.labels[13].position.row).toBe(0);
    expect(result.labels[14].position.column).toBe(1);
    expect(result.labels[14].position.row).toBe(1);
  });

  test('label dimensions constants are correct', () => {
    expect(LABEL_WIDTH_MM).toBe(22);
    expect(LABEL_HEIGHT_MM).toBe(28);
    expect(SHEET_WIDTH_MM).toBe(210);
    expect(SHEET_HEIGHT_MM).toBe(297);
    expect(LABELS_PER_SHEET).toBe(91);
  });
});