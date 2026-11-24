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
import { MM_TO_PT } from '@/lib/label-layout';
import { PRENDA_LABEL_LAYOUTS } from '@/lib/label-prenda-layout';
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

/** `r g b rg` (relleno), como lo escribe pdf-lib para un hex. */
const fillOp = (hex: string) =>
  `${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).join(' ')} rg`;

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** Textos WinAnsi dibujados, en orden, con su línea de base en pt. */
const drawnTexts = (base64: string): Array<{ text: string; y: number }> => {
  const textos: Array<{ text: string; y: number }> = [];
  const patron = /1 0 0 1 ([\d.]+) (-?[\d.]+) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g;

  for (const stream of pageStreams(base64)) {
    let match: RegExpExecArray | null;
    while ((match = patron.exec(stream)) !== null) {
      textos.push({
        y: Number(match[2]),
        text: Buffer.from(match[3], 'hex').toString('latin1'),
      });
    }
  }

  return textos;
};

/** Solo las líneas de la etiqueta (la marca va por glifos de Shrikhand). */
const prendaLines = (base64: string) =>
  drawnTexts(base64).filter(
    (linea) => linea.text.includes('Talle: ') || linea.text.includes('Variante: ') || linea.text.startsWith('$ ')
  );

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

/** Dos combinaciones del mismo talle con distinto color, y una sin variante. */
const prendaConVariantes = {
  id: 9,
  code: 'RPH020',
  price: 18000,
  prenda: {
    esUnica: false,
    talles: [
      { talle: 'M', variante: 'rojo' },
      { talle: 'M', variante: 'azul' },
      { talle: 'S', variante: '' },
    ],
  },
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

describe('generatePrendaLabels — una etiqueta por talle + variante', () => {
  beforeEach(() => {
    mockProductFindMany.mockResolvedValue([prendaConVariantes]);
  });

  test('M/rojo 1 y M/azul 2 → tres etiquetas, cada una con su variante', async () => {
    const result = await generatePrendaLabels({
      selections: [
        { productId: 9, talle: 'M', variante: 'rojo', quantity: 1 },
        { productId: 9, talle: 'M', variante: 'azul', quantity: 2 },
      ],
      tamano: 'grande',
    });

    if (!result.success) throw new Error(result.error);
    const texto = winAnsiText(result.data.pdfBase64);

    // Tres etiquetas: una del talle+variante rojo y dos del azul.
    expect(count(texto, 'RPH020')).toBe(3);
    expect(count(texto, 'Talle: M')).toBe(3);
    expect(count(texto, '18.000,00')).toBe(3);
    expect(count(texto, 'Variante: rojo')).toBe(1);
    expect(count(texto, 'Variante: azul')).toBe(2);
  });

  test('sin variante la línea no se dibuja y el precio sube un renglón', async () => {
    const result = await generatePrendaLabels({
      selections: [
        { productId: 9, talle: 'M', variante: 'rojo', quantity: 1 },
        { productId: 9, talle: 'S', quantity: 1 },
      ],
      tamano: 'mediana',
    });

    if (!result.success) throw new Error(result.error);
    // Solo la etiqueta de M/rojo lleva la línea: la del talle sin variante no.
    expect(count(winAnsiText(result.data.pdfBase64), 'Variante: ')).toBe(1);

    // Orden de dibujo de cada etiqueta: talle, [variante], precio.
    const lineas = prendaLines(result.data.pdfBase64);
    const conVariante = lineas.findIndex((linea) => linea.text === 'Talle: M');
    const sinVariante = lineas.findIndex((linea) => linea.text === 'Talle: S');

    expect(lineas[conVariante + 1].text).toBe('Variante: rojo');
    expect(lineas[sinVariante + 1].text.startsWith('$ ')).toBe(true);
    // Sin la línea de variante el precio sube exactamente un renglón: la
    // separación Talle → Precio se cierra, no queda un hueco en blanco.
    const conVarianteGap = lineas[conVariante].y - lineas[conVariante + 2].y;
    const sinVarianteGap = lineas[sinVariante].y - lineas[sinVariante + 1].y;
    const renglon =
      (PRENDA_LABEL_LAYOUTS.mediana.varianteTopMm - PRENDA_LABEL_LAYOUTS.mediana.talleTopMm) *
      MM_TO_PT;
    expect(conVarianteGap - sinVarianteGap).toBeCloseTo(renglon, 6);
  });

  test('rechaza una combinación que la prenda no tiene', async () => {
    const result = await generatePrendaLabels({
      selections: [{ productId: 9, talle: 'M', variante: 'verde', quantity: 1 }],
      tamano: 'grande',
    });

    expect(result).toEqual({
      success: false,
      error: 'La variante «verde» no pertenece al talle «M» de la prenda RPH020',
    });
  });

  test('el conteo por hoja sigue igual: 20 medianas en una hoja y 21 en dos', async () => {
    const unaHoja = await generatePrendaLabels({
      selections: [{ productId: 9, talle: 'M', variante: 'azul', quantity: 20 }],
      tamano: 'mediana',
    });
    const dosHojas = await generatePrendaLabels({
      selections: [{ productId: 9, talle: 'M', variante: 'azul', quantity: 21 }],
      tamano: 'mediana',
    });

    if (!unaHoja.success) throw new Error(unaHoja.error);
    if (!dosHojas.success) throw new Error(dosHojas.error);

    const pages = async (base64: string) =>
      (await PDFDocument.load(Buffer.from(base64, 'base64'))).getPageCount();

    await expect(pages(unaHoja.data.pdfBase64)).resolves.toBe(1);
    await expect(pages(dosHojas.data.pdfBase64)).resolves.toBe(2);
  });
});

/** Texto de **una** página del documento: Helvetica no lleva CMap, sus `Tj` son WinAnsi. */const winAnsiPage = (doc: PDFDocument, index: number): string => {
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

  test('los peluches marcados llevan la etiqueta del peluche y el resto la de producto', async () => {
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

    // La del peluche es vertical, lleva código, marca y precio.
    const chica = winAnsiPage(doc, 1);
    const { width, height } = doc.getPage(1).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
    expect(chica).toContain('BBB888');
    expect(chica).toContain('99,50');
    const marca = await readPdfContent(
      new Uint8Array(Buffer.from(result.data.pdfBase64, 'base64'))
    );
    expect(marca.text).toContain("Polkalina's");
  });

  test('la etiqueta del peluche es de 30 × 45 mm y entran 36 por hoja A4 vertical', async () => {
    mockCatalogo([jabon]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 36 }],
      pelucheIds: [1],
    });
    if (!result.success) throw new Error(result.error);

    const doc = await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64'));
    // Grilla de 6 × 6 = 36 etiquetas por hoja.
    expect(doc.getPageCount()).toBe(1);
    expect(count(winAnsiPage(doc, 0), '1.250,00')).toBe(36);
    expect(count(winAnsiPage(doc, 0), 'AAA001')).toBe(36);

    const justo = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 37 }],
      pelucheIds: [1],
    });
    if (!justo.success) throw new Error(justo.error);
    expect(
      (await PDFDocument.load(Buffer.from(justo.data.pdfBase64, 'base64'))).getPageCount()
    ).toBe(2);
  });

  test('un peluche con código largo y precio alto conserva el dato completo', async () => {
    mockCatalogo([{ id: 1, code: 'ABCD1234', price: 299999.99, kind: 'PRODUCT' }]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 1 }],
      pelucheIds: [1],
    });
    if (!result.success) throw new Error(result.error);

    // El texto se achica para entrar en los 30 mm; nunca se recorta el dato.
    const chica = winAnsiPage(
      await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64')),
      0
    );
    expect(chica).toContain('Código: ABCD1234');
    expect(chica).toContain('299.999,99');
  });

  test('la etiqueta del peluche: precio en frutilla y marca con la frutilla vectorial', async () => {
    mockCatalogo([jabon]);

    const result = await generateProductLabels({
      branchId: 3,
      selections: [{ productId: 1, quantity: 1 }],
      pelucheIds: [1],
    });
    if (!result.success) throw new Error(result.error);

    const chica = winAnsiPage(
      await PDFDocument.load(Buffer.from(result.data.pdfBase64, 'base64')),
      0
    );
    // El importe va en el frutilla de la marca; el código, en cacao.
    expect(chica).toContain('Código: AAA001');
    expect(chica).toContain(fillOp('#C8323C'));
    expect(chica).toContain(fillOp('#4A2C2A'));
    // Y ni el rosa viejo ni el rosa muy claro anterior aparecen.
    expect(chica).not.toContain(fillOp('#FCD2D3'));
    expect(chica).not.toContain(fillOp('#FBE7EC'));
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
