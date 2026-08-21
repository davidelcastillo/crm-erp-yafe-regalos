// src/lib/utils/pdf.test.ts
import { PDFDocument } from 'pdf-lib';
import { buildExportFileName, generateProductsPdf, ProductRow } from './pdf';

// Mock pdf-lib (no fs/promises needed — we use the standard Helvetica font)
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockReturnValue({
      addPage: jest.fn().mockReturnValue({
        drawRectangle: jest.fn(),
        drawText: jest.fn(),
      }),
      embedFont: jest.fn().mockResolvedValue({
        widthOfTextAtSize: jest.fn().mockResolvedValue(10),
      }),
      save: jest.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])), // "%PDF"
    }),
  },
  rgb: jest.fn(),
  StandardFonts: {
    Helvetica: 'Helvetica',
  },
}));

const makeRows = (n: number): ProductRow[] =>
  Array.from({ length: n }, (_, i) => ({
    code: `P${String(i).padStart(3, '0')}`,
    name: `Producto ${i}`,
    stock: i,
    price: 1000 + i,
  }));

const addPageMock = (): jest.Mock =>
  (PDFDocument.create as jest.Mock).mock.results[0].value.addPage;

describe('generateProductsPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('single page: renders rows and returns a base64 string', async () => {
    const result = await generateProductsPdf(makeRows(5));

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(addPageMock()).toHaveBeenCalledTimes(1);
  });

  test('multi-page: overflows to a new page without truncation', async () => {
    const result = await generateProductsPdf(makeRows(80));

    const addPage = addPageMock();
    expect(addPage).toHaveBeenCalled();
    expect(addPage.mock.calls.length).toBeGreaterThan(1);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('buildExportFileName', () => {
  test('formats inventario-DEP-20260806.pdf for branch DEP on 2026-08-06', () => {
    expect(buildExportFileName('DEP', new Date(2026, 7, 6))).toBe(
      'inventario-DEP-20260806.pdf'
    );
  });
});
