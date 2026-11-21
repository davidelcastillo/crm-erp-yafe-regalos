/**
 * @jest-environment node
 *
 * Etiquetas de prenda (pedido del dueño): una etiqueta por unidad de cada
 * talle, con el código, el talle y el precio reales de la prenda. El pdf-lib es
 * real y la marca va con Shrikhand embebida, así que media suite lee los bytes
 * del documento (mismo criterio que `label-print.test.ts`).
 */
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { requireAdmin } from '@/lib/auth-guard';
import { readPdfContent } from '@/lib/fonts/pdf-test-reader';
import { generatePrendaLabels } from './label-print';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    branch: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

const mockProductFindMany = prisma.product.findMany as jest.Mock;
const mockRequireAdmin = requireAdmin as jest.Mock;

/** Contenido de los streams de página, ya inflados. */
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
      if (inflated.includes('BT')) streams.push(inflated);
    } catch {
      // Los streams sin compresión no son contenido de dibujo.
    }
  }

  return streams;
};

/**
 * Texto de las fuentes estándar (código, talle, precio y «ÚNICA»): Helvetica no
 * lleva CMap y sus `Tj` son bytes WinAnsi. La marca va con Shrikhand y se lee
 * aparte, por glifos.
 */
const winAnsiText = (base64: string): string =>
  pageStreams(base64)
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_all, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );

const embeddedText = async (base64: string): Promise<string> => {
  const content = await readPdfContent(Buffer.from(base64, 'base64'));
  return content.text.join('\n');
};

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const prendaConTalles = {
  id: 7,
  code: 'RPH014',
  price: 24000,
  prenda: { esUnica: false, talles: [{ talle: 'S' }, { talle: 'M' }] },
};

const prendaUnica = {
  id: 8,
  code: 'RPI003',
  price: 15900,
  prenda: { esUnica: true, talles: [{ talle: 'Único' }] },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProductFindMany.mockResolvedValue([prendaConTalles, prendaUnica]);
});

describe('generatePrendaLabels — la marca y los datos de la prenda', () => {
  test('primero exige sesión de admin: sin ella no se lee nada', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: 'No autorizado' });

    const result = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'S', quantity: 1 }],
      tamano: 'grande',
    });

    expect(result).toEqual({ success: false, error: 'No autorizado' });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('el PDF lleva «Polkalina\'s», el código, el talle y el precio', async () => {
    const result = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'S', quantity: 1 }],
      tamano: 'grande',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filename).toMatch(/^etiquetas-prenda-RPH014-grande-\d{8}\.pdf$/);
    expect(await embeddedText(result.data.pdfBase64)).toContain("Polkalina's");

    const texto = winAnsiText(result.data.pdfBase64);
    expect(texto).toContain('RPH014');
    expect(texto).toContain('Talle: S');
    expect(texto).toContain('24.000,00');
  });

  test('N unidades del talle → N etiquetas, una por talle', async () => {
    const result = await generatePrendaLabels({
      selections: [
        { productId: 7, talle: 'S', quantity: 2 },
        { productId: 7, talle: 'M', quantity: 1 },
      ],
      tamano: 'mediana',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const texto = winAnsiText(result.data.pdfBase64);
    expect(count(texto, 'Talle: S')).toBe(2);
    expect(count(texto, 'Talle: M')).toBe(1);
    expect(count(texto, 'RPH014')).toBe(3);
    expect(count(texto, '24.000,00')).toBe(3);
  });

  test('«ÚNICA» aparece solo en prendas únicas', async () => {
    const unica = await generatePrendaLabels({
      selections: [{ productId: 8, talle: 'Único', quantity: 1 }],
      tamano: 'grande',
    });
    const conTalles = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'S', quantity: 1 }],
      tamano: 'grande',
    });

    expect(unica.success && conTalles.success).toBe(true);
    if (!unica.success || !conTalles.success) return;

    expect(winAnsiText(unica.data.pdfBase64)).toContain('ÚNICA');
    expect(winAnsiText(unica.data.pdfBase64)).toContain('Talle: Único');
    expect(winAnsiText(conTalles.data.pdfBase64)).not.toContain('ÚNICA');
  });

  test('la hoja es A4 vertical y las hojas se cuentan por tamaño', async () => {
    const grande = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'S', quantity: 10 }],
      tamano: 'grande',
    });
    const mediana = await generatePrendaLabels({
      selections: [
        { productId: 7, talle: 'S', quantity: 20 },
        { productId: 7, talle: 'M', quantity: 1 },
      ],
      tamano: 'mediana',
    });

    expect(grande.success && mediana.success).toBe(true);
    if (!grande.success || !mediana.success) return;

    for (const [result, pages] of [
      [grande, 2],
      [mediana, 2],
    ] as const) {
      const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
      expect(doc.getPageCount()).toBe(pages);
      const { width, height } = doc.getPage(0).getSize();
      expect(width).toBeCloseTo(595.28, 1);
      expect(height).toBeCloseTo(841.89, 1);
    }
  });
});

describe('generatePrendaLabels — validación en el servidor', () => {
  test('rechaza una selección vacía', async () => {
    const result = await generatePrendaLabels({ selections: [], tamano: 'grande' });

    expect(result).toEqual({ success: false, error: 'Seleccioná al menos un talle' });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('rechaza un tamaño de etiqueta desconocido', async () => {
    const result = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'S', quantity: 1 }],
      tamano: 'gigante',
    });

    expect(result.success).toBe(false);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('rechaza un talle que no pertenece a la prenda', async () => {
    const result = await generatePrendaLabels({
      selections: [{ productId: 7, talle: 'XL', quantity: 1 }],
      tamano: 'grande',
    });

    expect(result).toEqual({
      success: false,
      error: 'El talle «XL» no pertenece a la prenda RPH014',
    });
  });

  test('rechaza una prenda que no existe', async () => {
    mockProductFindMany.mockResolvedValue([]);

    const result = await generatePrendaLabels({
      selections: [{ productId: 99, talle: 'S', quantity: 1 }],
      tamano: 'grande',
    });

    expect(result).toEqual({ success: false, error: 'Prenda no encontrada' });
  });
});
