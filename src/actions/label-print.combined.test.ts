/**
 * @jest-environment node
 *
 * S1/S2/S5: el comprobante de un ingreso y las etiquetas de lo ingresado en un
 * **solo** PDF. El pdf-lib y las fuentes son reales (mismo criterio que
 * `label-print.test.ts`), así que el lector de documentos decide si el texto del
 * comprobante y el de las etiquetas sobreviven a la combinación.
 */
import { PDFArray, PDFDocument, PDFStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { readPdfContent } from '@/lib/fonts/pdf-test-reader';
import { generateEntryReceiptWithLabels } from './label-print';
import { prisma } from '@/lib/prisma';

/**
 * Texto de una página tal como está en el content stream. El lector de
 * documentos traduce las fuentes embebidas (Poppins, Shrikhand) por su CMap
 * `/ToUnicode`; el código y el precio de la etiqueta van con Helvetica, que no
 * lleva CMap, así que sus `Tj` siguen siendo bytes WinAnsi.
 */
const winAnsiText = (doc: PDFDocument, index: number): string => {
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents!];
  return refs
    .map((ref) => inflateSync(doc.context.lookup(ref, PDFStream).getContents()).toString('latin1'))
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_all, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    branch: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

const mockBranchFindUnique = prisma.branch.findUnique as jest.Mock;
const mockProductFindMany = prisma.product.findMany as jest.Mock;

const receipt = {
  movementType: 'ENTRY' as const,
  branchId: 7,
  date: '2026-08-06T18:30:00.000Z',
  branchName: 'Sucursal Centro',
  branchCode: 'CEN',
  reference: 'Conteo físico',
  rows: [
    { productId: 1, code: 'AAA001', name: 'Producto A', quantity: 2, stock: 12, price: 1250 },
    { productId: 2, code: 'BBB888', name: 'Producto B', quantity: 1, stock: 5, price: 99.5 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchFindUnique.mockResolvedValue({ code: 'CEN' });
  mockProductFindMany.mockResolvedValue([
    { id: 1, code: 'AAA001', price: 1250 },
    { id: 2, code: 'BBB888', price: 99.5 },
  ]);
});

describe('generateEntryReceiptWithLabels — comprobante + etiquetas (S2)', () => {
  test('devuelve un solo PDF: primero el comprobante y después las etiquetas', async () => {
    const result = await generateEntryReceiptWithLabels(receipt);
    if (!result.success) throw new Error(result.error);

    const { doc, text } = await readPdfContent(
      new Uint8Array(Buffer.from(result.data.pdfBase64, 'base64'))
    );
    const [comprobante, etiquetas] = doc.getPages();
    expect(doc.getPageCount()).toBe(2);

    // La primera página es el comprobante (A4 vertical) y conserva su texto.
    expect(comprobante.getSize().width).toBeCloseTo(595.28, 1);
    expect(comprobante.getSize().height).toBeCloseTo(841.89, 1);
    expect(text).toContain('Ingreso');
    expect(text.join(' ')).toContain('Sucursal Centro (CEN)');
    expect(text.join(' ')).toContain('Motivo: Conteo físico');
    expect(text).toContain('+2');

    // La segunda es la hoja de etiquetas (A4 horizontal), con una por unidad:
    // el código y el precio salen en las dos unidades del producto A.
    expect(etiquetas.getSize().width).toBeCloseTo(841.89, 1);
    expect(etiquetas.getSize().height).toBeCloseTo(595.28, 1);
    const labels = winAnsiText(doc, 1);
    expect(labels.match(/AAA001/g)).toHaveLength(2);
    expect(labels.match(/BBB888/g)).toHaveLength(1);
    expect(labels).toContain('1.250,00');
    // El handle de la plantilla sigue leyéndose por ToUnicode: una vez por etiqueta.
    expect(text.filter((value) => value === '@feria_conexx')).toHaveLength(3);
  });

  test('la última hoja de etiquetas queda rellena para escribir a mano (S4)', async () => {
    const result = await generateEntryReceiptWithLabels(receipt);
    if (!result.success) throw new Error(result.error);

    const { doc, text } = await readPdfContent(
      new Uint8Array(Buffer.from(result.data.pdfBase64, 'base64'))
    );
    expect(doc.getPageCount()).toBe(2);
    // 3 unidades → 3 etiquetas con código y precio; el relleno no dibuja texto.
    const labels = winAnsiText(doc, 1);
    expect(labels.match(/AAA001/g)).toHaveLength(2);
    expect(labels.match(/BBB888/g)).toHaveLength(1);
    expect(text.filter((value) => value === '@feria_conexx')).toHaveLength(3);
  });

  test('nombra el archivo como el comprobante de un ingreso con etiquetas', async () => {
    const result = await generateEntryReceiptWithLabels(receipt);
    if (!result.success) throw new Error(result.error);

    expect(result.data.filename).toBe('comprobante-ingreso-CEN-20260806-etiquetas.pdf');
  });

  test('rechaza un comprobante que no es un ingreso (S3)', async () => {
    const result = await generateEntryReceiptWithLabels({
      ...receipt,
      movementType: 'EXIT',
    });

    expect(result).toEqual({
      success: false,
      error: 'Solo el comprobante de un ingreso lleva etiquetas',
    });
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('rechaza un comprobante sin sucursal y no consulta Prisma', async () => {
    const sinSucursal = { ...receipt, branchId: undefined };

    const result = await generateEntryReceiptWithLabels(sinSucursal);

    expect(result.success).toBe(false);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('avisa si algún producto del comprobante ya no tiene stock en la sucursal', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 1, code: 'AAA001', price: 1250 }]);

    const result = await generateEntryReceiptWithLabels(receipt);

    expect(result).toEqual({
      success: false,
      error: 'Hay productos inactivos o sin stock en la sucursal seleccionada',
    });
  });

  test('pide las etiquetas con la sucursal del comprobante y una unidad por unidad ingresada', async () => {
    const result = await generateEntryReceiptWithLabels(receipt);
    if (!result.success) throw new Error(result.error);

    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inventory: { some: { branchId: 7, stock: { gt: 0 } } } }),
      })
    );
  });
});

// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe('comprobante con etiquetas: autorización admin', () => {
  test('rechaza la acción sin sesión admin y no consulta Prisma', async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      '@/lib/auth-guard'
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: 'No autorizado' });

    const resultado = await generateEntryReceiptWithLabels(receipt);

    expect(resultado).toEqual({ success: false, error: 'No autorizado' });
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});
