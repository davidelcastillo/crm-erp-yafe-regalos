/**
 * @jest-environment node
 *
 * El pdf-lib real tiene que leer de vuelta los bytes generados, cosa que falla
 * bajo el Uint8Array de otro realm de jsdom, así que esta suite corre en node
 * (mismo criterio que `src/lib/utils/pdf.test.ts`).
 */
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import zlib from 'zlib';
// @ts-expect-error -- fontkit no publica tipos (mismo criterio que `label-print.ts`)
import * as fontkit from 'fontkit';
import { generateProductLabels } from './label-print';
import { prisma } from '@/lib/prisma';
import { SHRIKHAND_TTF_BASE64 } from '@/lib/fonts/shrikhand';
import {
  AMOUNT_MIN_FONT_SIZE_PT,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_MIN_FONT_SIZE_PT,
  HANDLE_MIN_FONT_SIZE_PT,
  HANDLE_TEXT,
  HANDLE_TOP_MM,
  LABEL_HEIGHT_MM,
  LABEL_INSET_Y_MM,
  PRICE_BOX_COLOR,
  PRICE_BOX_HEIGHT_MM,
  PRICE_BOX_TOP_MM,
  PRICE_TEXT_COLOR,
} from '@/lib/label-layout';

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

/** Operadores de trazo (`S`): cada marca de corte es un segmento trazado. */
const strokeOps = (base64: string): number =>
  pageStreams(base64).join(' ').match(/(?:^|\s)S(?=\s|$)/g)?.length ?? 0;

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

/** `r g b rg` (relleno) o `r g b RG` (trazo), como lo escribe pdf-lib para un hex. */
const colorOp = (hex: string, op: 'rg' | 'RG'): string =>
  `${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).join(' ')} ${op}`;

/** Paleta de la marca: cacao del texto, crema del fondo y rosa de las cajas. */
const CACAO = '#4A2C2A';
const CREAM = '#FFF6F0';
const PINK = '#F2C4CC';

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

  test('el código, el importe, el `$` y el handle van en cacao de la marca', async () => {
    mockProductFindMany.mockResolvedValue([{ id: 1, code: 'AAA001', price: 1500 }]);

    const result = await generateProductLabels({
      branchId: 2,
      selections: [{ productId: 1, quantity: 1 }],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);

    const content = pageStreams(result.data.pdfBase64).join("\n");
    // Los cuatro textos (código, $, importe y handle) van en cacao #4A2C2A.
    expect(content).toContain(colorOp(CACAO, 'rg'));
    // Nada de la paleta vieja: ni #222222, ni #6b2b43, ni negro pleno.
    expect(content).not.toContain(colorOp('#222222', 'rg'));
    expect(content).not.toContain(colorOp('#6b2b43', 'rg'));
    expect(content).not.toContain(colorOp('#000000', 'rg'));
  });

  test('dibuja las marcas de corte: 8 ticks por etiqueta, en cacao', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 5 }],
    });
    if (!result.success) throw new Error(result.error);

    const content = pageStreams(result.data.pdfBase64).join(' ');
    // Cacao como color de TRAZO (RG), no de relleno (rg): negro ya no se usa.
    expect(content).toContain(colorOp(CACAO, 'RG'));
    expect(content).not.toContain(colorOp('#000000', 'RG'));
    // Dos ticks por esquina: 8 por etiqueta, 40 para 5 etiquetas.
    expect(strokeOps(result.data.pdfBase64)).toBe(5 * 8);
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

    // Cuatro textos por etiqueta: código, $, precio y «Polkalina's».
    expect(textOperators(result.data.pdfBase64)).toBe(5 * 4);

    // El handle («Polkalina's» = 11 glifos) va una vez por etiqueta, con su hex.
    const handles = hexTexts(result.data.pdfBase64).filter(
      (hex) => hex.length === "Polkalina's".length * 4
    );
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

// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe('etiquetas: autorización admin', () => {
  test('rechaza generateProductLabels sin sesión admin y no consulta Prisma', async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      '@/lib/auth-guard'
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: 'No autorizado' });

    // Selección vacía: si el guardián no fuera primero, el error sería de Zod.
    const resultado = await generateProductLabels({ branchId: 1, selections: [] });

    expect(resultado).toEqual({ success: false, error: 'No autorizado' });
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});

// S4: la última hoja se completa con etiquetas vacías para escribir a mano.
describe('generateProductLabels — última hoja rellenada (S4)', () => {
  /** Operadores de relleno (`rg`) de un color de la plantilla. */
  const fillOps = (base64: string, hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const op = `${r} ${g} ${b} rg`;
    return pageStreams(base64).join('\n').split(op).length - 1;
  };

  test('con el relleno pedido completa la hoja con etiquetas sin código ni precio', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 5 }],
      fillLastSheet: true,
    });
    if (!result.success) throw new Error(result.error);

    const pdfDoc = await loadPdf(result.data.pdfBase64);
    expect(pdfDoc.getPageCount()).toBe(1);

    // Las 5 etiquetas reales llevan sus 4 textos; las 67 de relleno, ninguno.
    expect(pdfText(result.data.pdfBase64).match(/AAA001/g)).toHaveLength(5);
    expect(textOperators(result.data.pdfBase64)).toBe(5 * 4);

    // El relleno conserva la etiqueta crema (72 fondos) y las marcas de corte (72 × 8).
    expect(fillOps(result.data.pdfBase64, CREAM)).toBe(LABELS_PER_SHEET);
    expect(strokeOps(result.data.pdfBase64)).toBe(LABELS_PER_SHEET * 8);
    // Cajas del código (rosa) y del importe (rosa claro) solo en las 5 reales:
    // 6 rellenos por caja redondeada (2 rectángulos cruzados + 4 círculos).
    expect(fillOps(result.data.pdfBase64, PINK)).toBe(5 * 6);
    expect(fillOps(result.data.pdfBase64, PRICE_BOX_COLOR)).toBe(5 * 6);
  });

  test('sin el relleno la hoja queda como estaba: solo las etiquetas pedidas', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 5 }],
    });
    if (!result.success) throw new Error(result.error);

    expect(fillOps(result.data.pdfBase64, CREAM)).toBe(5);
    expect(strokeOps(result.data.pdfBase64)).toBe(5 * 8);
    expect(fillOps(result.data.pdfBase64, PINK)).toBe(5 * 6);
    expect(fillOps(result.data.pdfBase64, PRICE_BOX_COLOR)).toBe(5 * 6);
  });

  test('el relleno se suma a las hojas ya completas sin agregar páginas', async () => {
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: LABELS_PER_SHEET + 1 }],
      fillLastSheet: true,
    });
    if (!result.success) throw new Error(result.error);

    expect((await loadPdf(result.data.pdfBase64)).getPageCount()).toBe(2);
    expect(textOperators(result.data.pdfBase64)).toBe((LABELS_PER_SHEET + 1) * 4);
    expect(strokeOps(result.data.pdfBase64)).toBe(2 * LABELS_PER_SHEET * 8);
  });
});

// L13: el dueño mandó la etiqueta impresa con el importe cortado ($299,9 en vez
// de $299,95) y el handle saliéndose de su lugar. Lo que se mide acá es el
// ancho y el alto **dibujados**, no los que se pidieron.
type TextRun = {
  size: number;
  x: number;
  y: number;
  fill: string;
  hex: string;
  text: string;
};

/** Cada `drawText`: tamaño, origen (línea de base, puntos) y texto mostrado. */
const textRuns = (base64: string): TextRun[] => {
  const runs: TextRun[] = [];
  for (const block of pageStreams(base64).join('\n').match(/BT[\s\S]*?ET/g) ?? []) {
    const size = block.match(/\/[^\s]+\s+([\d.]+)\s+Tf/)?.[1];
    const origin = block.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/);
    const shown = block.match(/<([0-9A-Fa-f]+)>\s*Tj/);
    const fill = block.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/);
    if (!size || !origin || !shown) continue;
    runs.push({
      size: Number(size),
      x: Number(origin[1]),
      y: Number(origin[2]),
      fill: fill ? `${fill[1]} ${fill[2]} ${fill[3]} rg` : '',
      hex: shown[1],
      text: Buffer.from(shown[1], 'hex').toString('latin1'),
    });
  }
  return runs;
};

/**
 * Los textos de una etiqueta por su papel: el `$` y el handle van con la fuente
 * embebida (llegado como ids de glifo), el código y el importe en Helvetica.
 */
const labelTexts = (base64: string) => {
  const runs = textRuns(base64);
  const handleHexLen = HANDLE_TEXT.length * 4;
  const handle = runs.filter((run) => run.hex.length === handleHexLen);
  const dollar = runs.filter((run) => run.hex.length === 4);
  const plain = runs.filter((run) => run.hex.length !== 4 && run.hex.length !== handleHexLen);
  return { dollar, handle, plain };
};

/** Fuentes de la etiqueta, para medir el ancho realmente dibujado. */
let medidores: { display: PDFFont; bold: PDFFont } | undefined;
const fontMetrics = async () => {
  if (!medidores) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    medidores = {
      display: await doc.embedFont(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64')),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
  }
  return medidores;
};

/** Tinta real de un texto en el TTF de Shrikhand, en em sobre la línea base. */
const inkEm = (text: string) => {
  const font = fontkit.create(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64'));
  let arriba = -Infinity;
  let abajo = Infinity;
  for (const glyph of font.layout(text).glyphs) {
    arriba = Math.max(arriba, glyph.bbox.maxY);
    abajo = Math.min(abajo, glyph.bbox.minY);
  }
  return { arriba: arriba / font.unitsPerEm, abajo: abajo / font.unitsPerEm };
};

describe('etiquetas — textos largos: nada se sale de su caja', () => {
  const MM = 72 / 25.4;
  const CAJA_IZQ = BOX_LEFT_MM * MM;
  const CAJA_DER = (BOX_LEFT_MM + BOX_WIDTH_MM) * MM;
  /** mm desde el borde superior de la hoja a puntos desde el borde inferior. */
  const desdeArriba = (topMm: number) => (210 - topMm) * MM;

  const unEtiqueta = async (code: string, price: number) => {
    mockProductFindMany.mockResolvedValue([{ id: 1, code, price }]);
    const result = await generateProductLabels({
      branchId: 1,
      selections: [{ productId: 1, quantity: 1 }],
    });
    if (!result.success) throw new Error(result.error);
    return result.data.pdfBase64;
  };

  test('con código de 8 caracteres y $299.999,99 el texto entra completo en la caja', async () => {
    const pdf = await unEtiqueta('ABCD1234', 299999.99);
    const { display, bold } = await fontMetrics();
    const { dollar, handle, plain } = labelTexts(pdf);

    // Texto completo: no se pierde ni un carácter ni un centavo.
    expect(pdfText(pdf)).toContain('299.999,99');
    expect(plain.map((run) => run.text)).toEqual(['ABCD1234', '299.999,99']);
    expect(handle).toHaveLength(1);

    // Fondo de la caja: el ancho dibujado no pasa el borde derecho.
    const derecho = (run: TextRun, font: PDFFont, text: string) =>
      run.x + font.widthOfTextAtSize(text, run.size);

    const [code, amount] = plain;
    expect(code.x).toBeGreaterThanOrEqual(CAJA_IZQ - 1e-6);
    expect(derecho(code, bold, code.text)).toBeLessThanOrEqual(CAJA_DER + 1e-6);
    expect(dollar[0].x).toBeGreaterThanOrEqual(CAJA_IZQ - 1e-6);
    expect(derecho(amount, bold, amount.text)).toBeLessThanOrEqual(CAJA_DER + 1e-6);
    expect(handle[0].x).toBeGreaterThanOrEqual(CAJA_IZQ - 1e-6);
    expect(derecho(handle[0], display, HANDLE_TEXT)).toBeLessThanOrEqual(CAJA_DER + 1e-6);
  });

  test('un importe que no entra ni al mínimo legible se parte en dos líneas sin perder centavos', async () => {
    const pdf = await unEtiqueta('ABCD1234', 299999999.99);
    const { bold } = await fontMetrics();
    const { handle, plain } = labelTexts(pdf);

    // El dato completo sigue en el PDF, repartido en dos líneas.
    const [code, ...amounts] = plain;
    expect(code.text).toBe('ABCD1234');
    expect(amounts.map((run) => run.text).join('')).toBe('299.999.999,99');

    // Ni el código ni el importe bajan del mínimo legible, y cada línea entra.
    for (const run of [code, ...amounts]) {
      expect(run.size).toBeGreaterThanOrEqual(CODE_MIN_FONT_SIZE_PT);
      expect(run.size).toBeGreaterThanOrEqual(AMOUNT_MIN_FONT_SIZE_PT);
      expect(run.x + bold.widthOfTextAtSize(run.text, run.size)).toBeLessThanOrEqual(
        CAJA_DER + 1e-6
      );
    }

    // Las dos líneas quedan dentro de la caja del importe.
    const cajaAbajo = desdeArriba(LABEL_INSET_Y_MM + PRICE_BOX_TOP_MM + PRICE_BOX_HEIGHT_MM);
    const cajaArriba = desdeArriba(LABEL_INSET_Y_MM + PRICE_BOX_TOP_MM);
    for (const run of amounts) {
      expect(run.y).toBeGreaterThanOrEqual(cajaAbajo);
      expect(run.y).toBeLessThanOrEqual(cajaArriba);
    }

    // El handle tampoco se achica de más.
    expect(handle[0].size).toBeGreaterThanOrEqual(HANDLE_MIN_FONT_SIZE_PT);
  });

  test('el handle entra en su banda: ni pisa la caja del importe ni se sale de la etiqueta', async () => {
    const pdf = await unEtiqueta('AAA001', 1250);
    const { handle } = labelTexts(pdf);
    const run = handle[0];

    expect(run.size).toBeGreaterThanOrEqual(HANDLE_MIN_FONT_SIZE_PT);

    // Tinta real del TTF, no la caja de línea (que es 1,458 em y no entra).
    const tinta = inkEm(HANDLE_TEXT);
    const arribaPdf = run.y + tinta.arriba * run.size;
    const abajoPdf = run.y + tinta.abajo * run.size;
    const bandaArriba = desdeArriba(LABEL_INSET_Y_MM + HANDLE_TOP_MM);
    const etiquetaAbajo = desdeArriba(LABEL_INSET_Y_MM + LABEL_HEIGHT_MM);

    expect(arribaPdf).toBeLessThanOrEqual(bandaArriba + 0.5);
    expect(abajoPdf).toBeGreaterThanOrEqual(etiquetaAbajo - 0.5);
  });

  test('el importe va en cacao sobre el rosa claro de su caja', async () => {
    const pdf = await unEtiqueta('AAA001', 1250);
    const { dollar, plain } = labelTexts(pdf);
    const amount = plain[1];

    expect(dollar[0].fill).toBe(colorOp(PRICE_TEXT_COLOR, 'rg'));
    expect(amount.fill).toBe(colorOp(PRICE_TEXT_COLOR, 'rg'));
    // La caja del importe se pinta con el rosa claro: 6 rellenos (2 rectángulos + 4 círculos).
    const rellenos = (hex: string) =>
      pageStreams(pdf).join('\n').split(colorOp(hex, 'rg')).length - 1;
    expect(rellenos(PRICE_BOX_COLOR)).toBe(6);
    expect(rellenos(PINK)).toBe(6);
  });
});
