/**
 * @jest-environment node
 *
 * Recorrido completo de las etiquetas: el usuario elige cantidades y el PDF
 * resultante tiene las hojas y las etiquetas que corresponden a la plantilla
 * (72 por hoja A4 horizontal, una página por hoja).
 */
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { generateProductLabels } from './label-print';
import { prisma } from '@/lib/prisma';
import { LABELS_PER_SHEET } from '@/lib/label-layout';

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
  mockBranchFindUnique.mockResolvedValue({ code: 'DEP' });
  mockProductFindMany.mockResolvedValue([
    { id: 1, code: 'AAA001', price: 150 },
    { id: 2, code: 'BBB888', price: 75.5 },
  ]);
});

describe('E2E etiquetas de precio', () => {
  test('2 de A y 1 de B generan 3 etiquetas en una sola hoja', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
    if (!result.success) throw new Error(result.error);

    const pdfDoc = await loadPdf(result.data.pdfBase64);
    expect(pdfDoc.getPageCount()).toBe(1);

    const text = pdfText(result.data.pdfBase64);
    expect(text.match(/AAA001/g)).toHaveLength(2);
    expect(text.match(/BBB888/g)).toHaveLength(1);
  });

  test('una hoja completa no desborda y la etiqueta siguiente abre otra', async () => {
    const llena = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: LABELS_PER_SHEET }],
    });
    if (!llena.success) throw new Error(llena.error);
    expect((await loadPdf(llena.data.pdfBase64)).getPageCount()).toBe(1);

    const conUnaMas = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: LABELS_PER_SHEET + 1 }],
    });
    if (!conUnaMas.success) throw new Error(conUnaMas.error);
    expect((await loadPdf(conUnaMas.data.pdfBase64)).getPageCount()).toBe(2);
  });
});
