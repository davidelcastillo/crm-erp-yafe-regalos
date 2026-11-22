/**
 * @jest-environment node
 *
 * Etiquetas de prenda (pedido del dueño): una etiqueta por unidad de cada
 * talle, con el código, el talle y el precio reales de la prenda. El pdf-lib es
 * real y la marca va con Shrikhand embebida, así que media suite lee los bytes
 * del documento (mismo criterio que `label-print.test.ts`).
 */
import { PDFArray, PDFDocument, PDFStream } from 'pdf-lib';
import zlib from 'zlib';
import { requireAdmin } from '@/lib/auth-guard';
import { readPdfContent } from '@/lib/fonts/pdf-test-reader';
import {
  detectPrendaProducts,
  generateEntryReceiptWithLabels,
  generatePrendaLabels,
  generateProductLabels,
} from './label-print';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    branch: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

const mockProductFindMany = prisma.product.findMany as jest.Mock;
const mockBranchFindUnique = prisma.branch.findUnique as jest.Mock;
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

/** Texto de **una** página del documento: Helvetica no lleva CMap, sus `Tj` son WinAnsi. */
const winAnsiPage = (doc: PDFDocument, index: number): string => {
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents!];
  return refs
    .map((ref) => zlib.inflateSync(doc.context.lookup(ref, PDFStream).getContents()).toString('latin1'))
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_all, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );
};

const jabon = { id: 1, code: 'AAA001', price: 1250, kind: 'PRODUCT' };
const shampoo = { id: 2, code: 'BBB888', price: 99.5, kind: 'PRODUCT' };
const prendaRph = {
  id: 7,
  code: 'RPH014',
  price: 24000,
  kind: 'PRENDA',
  prenda: { esUnica: false, talles: [{ talle: 'S' }, { talle: 'M' }] },
};

/**
 * La action consulta dos veces: las filas de la sucursal y, aparte, cuáles de
 * esas filas son prenda. El doble respeta el `where.kind` para que cada consulta
 * reciba solo lo suyo (una fila de prenda nunca llega sin su `kind`).
 */
const mockCatalogo = (rows: Array<{ kind?: string } & Record<string, unknown>>) => {
  mockProductFindMany.mockImplementation((args: { where?: { kind?: string } }) =>
    Promise.resolve(
      args?.where?.kind === 'PRENDA' ? rows.filter((row) => row.kind === 'PRENDA') : rows
    )
  );
};

describe('generateProductLabels — la detección separa prendas de productos', () => {
  beforeEach(() => {
    mockBranchFindUnique.mockResolvedValue({ code: 'CEN' });
  });

  test('selección mixta: las prendas salen con su etiqueta y el resto con la de producto', async () => {
    mockCatalogo([jabon, prendaRph]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [
        { productId: 1, quantity: 1 },
        { productId: 7, quantity: 2 },
      ],
      prendaTamano: 'mediana',
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    // Una hoja de producto (A4 horizontal) y una de prenda mediana (A4 vertical).
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(841.89, 1);
    expect(doc.getPage(1).getSize().width).toBeCloseTo(595.28, 1);

    const producto = winAnsiPage(doc, 0);
    expect(producto).toContain('AAA001');
    expect(producto).toContain('1.250,00');
    expect(producto).not.toContain('RPH014');

    // Dos unidades × los dos talles de la prenda: cuatro etiquetas de prenda.
    const prenda = winAnsiPage(doc, 1);
    expect(count(prenda, 'RPH014')).toBe(4);
    expect(count(prenda, 'Talle: S')).toBe(2);
    expect(count(prenda, 'Talle: M')).toBe(2);
    expect(count(prenda, '24.000,00')).toBe(4);
    expect(prenda).not.toContain('AAA001');
  });

  test('selección solo de productos: no pide tamaño y sale una única hoja de producto', async () => {
    mockCatalogo([jabon, shampoo]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 2 }],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(841.89, 1);
    const texto = winAnsiPage(doc, 0);
    expect(count(texto, 'AAA001')).toBe(2);
    expect(texto).not.toContain('Talle:');
  });

  test('sin tamaño elegido la prenda no se imprime: el servidor lo rechaza', async () => {
    mockCatalogo([jabon, prendaRph]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 7, quantity: 1 }],
    });

    expect(result).toEqual({
      success: false,
      error: 'Elegí el tamaño de las etiquetas de prenda',
    });
  });

  test('un tamaño de prenda desconocido no llega a Prisma', async () => {
    mockCatalogo([jabon, prendaRph]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 7, quantity: 1 }],
      prendaTamano: 'gigante',
    });

    expect(result.success).toBe(false);
  });

  test('la prenda la decide `kind`, no el prefijo del código', async () => {
    // Código con pinta de prenda pero `kind` de producto: sale la etiqueta normal.
    mockCatalogo([{ id: 5, code: 'RP999', price: 800, kind: 'PRODUCT' }]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 5, quantity: 1 }],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    const texto = winAnsiPage(doc, 0);
    expect(texto).toContain('RP999');
    expect(texto).not.toContain('Talle:');
  });

  test('los peluches marcados llevan la etiqueta chica y el resto la de producto', async () => {
    mockCatalogo([jabon, shampoo]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 },
      ],
      pelucheIds: [2],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    expect(doc.getPageCount()).toBe(2);

    const producto = winAnsiPage(doc, 0);
    expect(producto).toContain('AAA001');
    expect(producto).not.toContain('BBB888');

    // La chica no dibuja código: solo marca y precio (99,50).
    const chica = winAnsiPage(doc, 1);
    expect(chica).not.toContain('BBB888');
    expect(chica).toContain('99,50');
    const marca = await readPdfContent(
      new Uint8Array(Buffer.from(result.data.pdfBase64, 'base64'))
    );
    expect(marca.text).toContain("Polkalina's");
  });

  test('el tamaño de la etiqueta chica se respeta: cabe doce veces por fila en A4 horizontal', async () => {
    mockCatalogo([jabon]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 96 }],
      pelucheIds: [1],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    // 96 etiquetas chicas entran en una sola hoja A4 horizontal.
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
    expect(count(winAnsiPage(doc, 0), '1.250,00')).toBe(96);
  });

  test('un peluche que además es prenda sigue saliendo con la etiqueta de prenda', async () => {
    mockCatalogo([prendaRph]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 7, quantity: 1 }],
      prendaTamano: 'grande',
      pelucheIds: [7],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
    expect(count(winAnsiPage(doc, 0), 'RPH014')).toBe(2);
  });
});

describe('detectPrendaProducts — qué de la selección es prenda', () => {
  test('exige sesión admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: 'No autorizado' });

    await expect(detectPrendaProducts({ productIds: [1] })).resolves.toEqual({
      success: false,
      error: 'No autorizado',
    });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  test('devuelve solo los ids de las prendas de la selección', async () => {
    const rows = [jabon, prendaRph];
    await detectPrendaProducts({ productIds: [1, 7] });

    expect(mockProductFindMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 7] }, kind: 'PRENDA' },
      select: { id: true, kind: true },
    });

    // El doble del catálogo filtra por `where.kind`, igual que Prisma.
    mockCatalogo(rows);
    await expect(detectPrendaProducts({ productIds: [1, 7] })).resolves.toEqual({
      success: true,
      data: { prendaIds: [7] },
    });
  });

  test('sin prendas devuelve la lista vacía', async () => {
    mockCatalogo([jabon, shampoo]);

    await expect(detectPrendaProducts({ productIds: [1, 2] })).resolves.toEqual({
      success: true,
      data: { prendaIds: [] },
    });
  });

  test('rechaza una selección vacía', async () => {
    const resultado = await detectPrendaProducts({ productIds: [] });

    expect(resultado.success).toBe(false);
    expect(mockProductFindMany).not.toHaveBeenCalled();
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

// El comprobante con etiquetas no es solo del ingreso: el egreso y el traslado
// (lado que recibe) llevan las mismas etiquetas de lo que se movió.
describe('generateEntryReceiptWithLabels — egreso y traslado también llevan etiquetas', () => {
  const comprobante = {
    branchId: 3,
    date: '2026-08-06T18:30:00.000Z',
    branchName: 'Centro',
    branchCode: 'CEN',
    reference: 'Rotura',
    rows: [
      { productId: 1, code: 'AAA001', name: 'Jabón de Avena', quantity: 2, stock: 4, price: 1250 },
    ],
  };

  beforeEach(() => {
    mockBranchFindUnique.mockResolvedValue({ code: 'CEN' });
    mockCatalogo([jabon]);
  });

  test('acepta un egreso y arma su comprobante con etiquetas', async () => {
    const result = await generateEntryReceiptWithLabels({
      ...comprobante,
      movementType: 'EXIT',
    });

    if (!result.success) throw new Error(result.error);
    expect(result.data.filename).toBe('comprobante-egreso-CEN-20260806-etiquetas.pdf');
    expect(count(winAnsiText(result.data.pdfBase64), 'AAA001')).toBe(2);
  });

  test('acepta un traslado y arma el comprobante del lado que recibe', async () => {
    const result = await generateEntryReceiptWithLabels({
      ...comprobante,
      movementType: 'TRANSFER',
      sourceBranchName: 'Depósito',
      sourceBranchCode: 'DEP',
    });

    if (!result.success) throw new Error(result.error);
    expect(result.data.filename).toBe('comprobante-traslado-destino-CEN-20260806-etiquetas.pdf');
    expect(count(winAnsiText(result.data.pdfBase64), 'AAA001')).toBe(2);
  });

  test('sin sesión admin no consulta Prisma', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: 'No autorizado' });

    const resultado = await generateEntryReceiptWithLabels({
      ...comprobante,
      movementType: 'EXIT',
    });

    expect(resultado).toEqual({ success: false, error: 'No autorizado' });
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});
