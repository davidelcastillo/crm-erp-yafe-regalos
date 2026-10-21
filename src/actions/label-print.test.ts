/**
 * @jest-environment node
 *
 * El pdf-lib real tiene que leer de vuelta los bytes generados, cosa que falla
 * bajo el Uint8Array de otro realm de jsdom, así que esta suite corre en node
 * (mismo criterio que `src/lib/utils/pdf.test.ts`).
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

/** Contenido de los streams de página, ya inflados (solo los de dibujo). */
const pageStreams = (base64: string): string[] => {
  const buf = Buffer.from(base64, 'base64');
  const raw = buf.toString('latin1');
  const streams: string[] = [];
  const streamStart = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamStart.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const inflated = zlib.inflateSync(buf.subarray(start, end)).toString('latin1');
      if (inflated.includes('BT') && inflated.includes('Tj')) streams.push(inflated);
    } catch {
      // Los streams sin compresión no son contenido de dibujo.
    }
  }

  return streams;
};

/**
 * Texto dibujado con fuentes estándar (código y precio). Los textos de la fuente
 * embebida van como ids de glifo, así que se verifican aparte por su hex.
 */
const pdfText = (base64: string): string =>
  pageStreams(base64)
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>/g, (_all, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );

/** Cantidad total de operadores de texto (`Tj`) en las páginas. */
const textOperators = (base64: string): number =>
  pageStreams(base64).join('\n').match(/Tj/g)?.length ?? 0;

/** Strings hex que se muestran con `Tj` (uno por `drawText`). */
const hexTexts = (base64: string): string[] =>
  pageStreams(base64)
    .join('\n')
    .match(/<([0-9A-Fa-f]+)>\s*Tj/g)
    ?.map((op) => op.replace(/[^0-9A-Fa-f]/g, '')) ?? [];

/** Origen (línea de base) de cada `drawText`, en puntos y desde la esquina inferior. */
const textOrigins = (base64: string) =>
  pageStreams(base64)
    .join('\n')
    .match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g)
    ?.map((op) => {
      const [, x, y] = op.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/)!;
      return { x: Number(x), y: Number(y) };
    }) ?? [];

const LABELS_PER_SHEET = 72;

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchFindUnique.mockResolvedValue({ code: 'DEP' });
  mockProductFindMany.mockResolvedValue([
    { id: 1, code: 'AAA001', price: 1250 },
    { id: 2, code: 'BBB888', price: 99.5 },
  ]);
});

describe('generateProductLabels — validación en el servidor (S6)', () => {
  test('rechaza una selección vacía', async () => {
    const result = await generateProductLabels({ branchId: 1, selections: [] });

    expect(result).toEqual({
      success: false,
      error: 'Seleccioná al menos un producto',
    });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('rechaza cantidades fuera de 1..999', async () => {
    await expect(
      generateProductLabels({ branchId: 1, selections: [{ productId: 1, quantity: 0 }] })
    ).resolves.toEqual({ success: false, error: 'La cantidad mínima es 1' });

    await expect(
      generateProductLabels({ branchId: 1, selections: [{ productId: 1, quantity: 1000 }] })
    ).resolves.toEqual({ success: false, error: 'La cantidad máxima es 999' });
  });

  test('rechaza una sucursal inexistente', async () => {
    mockBranchFindUnique.mockResolvedValue(null);

    const result = await generateProductLabels({
      branchId: 9,
      selections: [{ productId: 1, quantity: 1 }],
    });

    expect(result).toEqual({ success: false, error: 'Sucursal no encontrada' });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('exige productos activos con stock > 0 en esa sucursal', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 1, code: 'AAA001', price: 1250 }]);

    const result = await generateProductLabels({
      branchId: 1,
      selections: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: 'Hay productos inactivos o sin stock en la sucursal seleccionada',
    });
    // El filtro vive en la consulta: activo y con fila de stock > 0 en la sucursal.
    expect(mockProductFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2] },
        active: true,
        inventory: { some: { branchId: 1, stock: { gt: 0 } } },
      },
      select: { id: true, code: true, price: true },
    });
  });
});

describe('generateProductLabels — PDF según la plantilla (§S3)', () => {
  test('devuelve un PDF de una página A4 horizontal y el nombre del archivo', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filename).toMatch(/^etiquetas-DEP-\d{8}\.pdf$/);

    const pdfDoc = await loadPdf(result.data.pdfBase64);
    expect(pdfDoc.getPageCount()).toBe(1);

    // A4 horizontal: 297 × 210 mm en puntos.
    const { width, height } = pdfDoc.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
  });

  test('imprime el código del producto y el precio', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 1 }],
    });
    if (!result.success) throw new Error(result.error);

    const text = pdfText(result.data.pdfBase64);
    expect(text).toContain('AAA001');
    expect(text).toContain('1.250,00');
  });

  test('el codigo va oscuro y el importe en negro; el tono de marca queda para $ y handle', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 1, code: 'AAA001', price: 1500 }]);

    const result = await generateProductLabels({
      branchId: 2,
      selections: [{ productId: 1, quantity: 1 }],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);

    const content = pageStreams(result.data.pdfBase64).join("\n");
    // Código: #222222, en negrita.
    expect(content).toContain(
      '0.13333333333333333 0.13333333333333333 0.13333333333333333 rg'
    );
    // Importe: negro pleno.
    expect(content).toContain('0 0 0 rg');
    // El tono de marca (#6b2b43) queda solo en el `$` y en @feria_conexx.
    expect(
      content.match(/0\.4196078431372549 0\.16862745098039217 0\.2627450980392157 rg/g)
    ).toHaveLength(2);
  });

  test('repite la etiqueta tantas veces como la cantidad pedida', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 2 },
      ],
    });
    if (!result.success) throw new Error(result.error);

    const text = pdfText(result.data.pdfBase64);
    expect(text.match(/AAA001/g)).toHaveLength(3);
    expect(text.match(/BBB888/g)).toHaveLength(2);
    expect(text.match(/1\.250,00/g)).toHaveLength(3);

    // Cuatro textos por etiqueta: código, $, precio y @feria_conexx.
    expect(textOperators(result.data.pdfBase64)).toBe(5 * 4);

    // El handle (@feria_conexx = 13 glifos) va una vez por etiqueta, con su hex.
    const handles = hexTexts(result.data.pdfBase64).filter((hex) => hex.length === 13 * 4);
    expect(handles).toHaveLength(5);
    expect(new Set(handles).size).toBe(1);
  });

  test('los cuatro textos de cada etiqueta caen dentro de su celda', async () => {
    // Dos etiquetas: la primera en la fila 0 y la segunda en la fila 1.
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 2 }],
    });
    if (!result.success) throw new Error(result.error);

    const mm = 72 / 25.4;
    const celda = (row: number) => {
      const top = row * 26.25;
      return { x0: 0, x1: 33 * mm, y0: (210 - top - 26.25) * mm, y1: (210 - top) * mm };
    };

    const origins = textOrigins(result.data.pdfBase64);
    expect(origins).toHaveLength(8);

    for (const [row, tramo] of [
      [0, origins.slice(0, 4)],
      [1, origins.slice(4)],
    ] as const) {
      const { x0, x1, y0, y1 } = celda(row);
      for (const origin of tramo) {
        expect(origin.x).toBeGreaterThanOrEqual(x0);
        expect(origin.x).toBeLessThanOrEqual(x1);
        expect(origin.y).toBeGreaterThanOrEqual(y0);
        expect(origin.y).toBeLessThanOrEqual(y1);
      }
    }
  });

  test('72 etiquetas piden una hoja y 73 piden dos', async () => {
    const primera = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: LABELS_PER_SHEET }],
    });
    if (!primera.success) throw new Error(primera.error);
    expect((await loadPdf(primera.data.pdfBase64)).getPageCount()).toBe(1);

    const segunda = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: LABELS_PER_SHEET + 1 }],
    });
    if (!segunda.success) throw new Error(segunda.error);
    const pdfDoc = await loadPdf(segunda.data.pdfBase64);
    expect(pdfDoc.getPageCount()).toBe(2);
    // Las etiquetas de la última hoja quedan en las primeras posiciones.
    expect(pdfText(segunda.data.pdfBase64).match(/AAA001/g)).toHaveLength(73);
  });
});
