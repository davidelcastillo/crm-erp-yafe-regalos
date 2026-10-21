/**
 * @jest-environment node
 *
 * Integración de la acción de etiquetas con los datos que el wizard ya filtró:
 * productos activos con stock en la sucursal, cantidades y orden de la selección.
 * El pdf-lib es real (ver `label-print.test.ts` sobre el entorno node).
 */
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { generateProductLabels } from './label-print';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    branch: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

const mockBranchFindUnique = prisma.branch.findUnique as jest.Mock;
const mockProductFindMany = prisma.product.findMany as jest.Mock;

const loadPdf = (base64: string) => PDFDocument.load(Buffer.from(base64, 'base64'));

const pdfText = (base64: string): string => {
  const buf = Buffer.from(base64, 'base64');
  const raw = buf.toString('latin1');
  const inflated: string[] = [];
  const streamStart = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamStart.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const stream = zlib.inflateSync(buf.subarray(start, end)).toString('latin1');
      if (stream.includes('BT')) inflated.push(stream);
    } catch {
      // Streams sin compresión: no son contenido de dibujo.
    }
  }

  return inflated
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>/g, (_all, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchFindUnique.mockResolvedValue({ code: 'CEN' });
  mockProductFindMany.mockResolvedValue([
    { id: 1, code: 'AAA001', price: 100 },
    { id: 2, code: 'BBB888', price: 200 },
  ]);
});

describe('generateProductLabels — flujo con las selecciones del wizard', () => {
  test('genera el PDF de una sucursal con dos productos y sus cantidades', async () => {
    const result = await generateProductLabels({
      branchId: 2,
      selections: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filename).toMatch(/^etiquetas-CEN-\d{8}\.pdf$/);

    const pdfDoc = await loadPdf(result.data.pdfBase64);
    expect(pdfDoc.getPageCount()).toBe(1);

    const { width, height } = pdfDoc.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
  });

  test('repite cada etiqueta y respeta el orden de la selección', async () => {
    const result = await generateProductLabels({
      branchId: 2,
      selections: [
        { productId: 2, quantity: 2 }, // BBB888 primero
        { productId: 1, quantity: 1 }, // AAA001 después
      ],
    });
    if (!result.success) throw new Error(result.error);

    const text = pdfText(result.data.pdfBase64);
    expect(text.match(/BBB888/g)).toHaveLength(2);
    expect(text.match(/AAA001/g)).toHaveLength(1);
    expect(text.indexOf('BBB888')).toBeLessThan(text.indexOf('AAA001'));
  });

  test('una sucursal sin los productos pedidos no genera PDF', async () => {
    mockProductFindMany.mockResolvedValue([]);

    const result = await generateProductLabels({
      branchId: 2,
      selections: [{ productId: 1, quantity: 1 }],
    });

    expect(result).toEqual({
      success: false,
      error: 'Hay productos inactivos o sin stock en la sucursal seleccionada',
    });
  });
});
