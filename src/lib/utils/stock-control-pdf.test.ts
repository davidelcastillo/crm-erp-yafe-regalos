/** @jest-environment node */
import { PDFDocument, PDFArray, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import type { StockControlReceipt } from '@/lib/stock-control-receipt';
import { generateStockControlPdf } from './stock-control-pdf';

const receipt: StockControlReceipt = {
  controlId: 7,
  branchId: 2,
  branchName: 'Punto Rosa',
  branchCode: 'PRO',
  closedAt: '2026-10-21T18:30:00.000Z',
  reason: 'Faltante del conteo físico',
  adjustedCount: 1,
  pendingCount: 1,
  items: [
    { code: 'QE9151-24', name: 'Vela aromática', systemStock: 29, countedStock: 27, difference: -2, decision: 'ACCEPTED' },
    { code: 'QE7948-22', name: 'Jabón de avena', systemStock: 7, countedStock: 5, difference: -2, decision: 'PENDING' },
  ],
};

/** Texto y color de cada `Tj` de los streams inflados. */
async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const text: string[] = [];
  const colors = new Map<string, number[]>();

  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    for (const ref of streams) {
      const stream = doc.context.lookup(ref) as PDFRawStream;
      const raw = inflateSync(stream.getContents()).toString('latin1');
      for (const match of raw.matchAll(/<([A-Fa-f0-9]+)> Tj/g)) {
        const value = Buffer.from(match[1], 'hex').toString('latin1');
        text.push(value);
        const operator = [...raw.slice(0, match.index).matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)].pop();
        if (operator && !colors.has(value)) {
          colors.set(value, [operator[1], operator[2], operator[3]].map((part) => Math.round(Number(part) * 100) / 100));
        }
      }
    }
  }

  return { doc, text, colors };
}

describe('generateStockControlPdf (S10)', () => {
  test('imprime sucursal, fecha, motivo y el detalle de cada diferencia', async () => {
    const { doc, text } = await readPdf(await generateStockControlPdf(receipt));
    const plano = text.join(' ');

    expect(doc.getPageCount()).toBe(1);
    expect(text).toContain('Ajuste de stock');
    expect(plano).toContain('Punto Rosa (PRO)');
    expect(plano).toContain('21/10/2026');
    expect(plano).toContain('Faltante del conteo físico');
    expect(plano).toContain('Control: #7');
    expect(plano).toContain('QE9151-24');
    expect(plano).toContain('QE7948-22');
    expect(plano).toContain('29');
    expect(plano).toContain('27');
  });

  test('distingue lo ajustado de lo pendiente y resume el cierre', async () => {
    const { text } = await readPdf(await generateStockControlPdf(receipt));

    expect(text).toContain('Ajustado');
    expect(text).toContain('Pendiente');
    expect(text.join(' ')).toContain('1 ajustados · 1 pendientes');
  });

  test('el faltante va en rojo y el sobrante en verde, con su signo', async () => {
    const { text, colors } = await readPdf(await generateStockControlPdf({
      ...receipt,
      adjustedCount: 2,
      pendingCount: 0,
      items: [
        { code: 'AAA001', name: 'Faltante', systemStock: 10, countedStock: 8, difference: -2, decision: 'ACCEPTED' },
        { code: 'BBB002', name: 'Sobrante', systemStock: 10, countedStock: 13, difference: 3, decision: 'ACCEPTED' },
      ],
    }));

    expect(text).toContain('-2');
    expect(text).toContain('+3');
    // #dc2626 para el faltante, #15803d para el sobrante (los tonos de las tarjetas).
    expect(colors.get('-2')).toEqual([0.86, 0.15, 0.15]);
    expect(colors.get('+3')).toEqual([0.08, 0.5, 0.24]);
  });

  test('sin ajustes aceptados el título lo aclara y el motivo cae a su texto por defecto', async () => {
    const { text } = await readPdf(await generateStockControlPdf({
      ...receipt, adjustedCount: 0, reason: null,
    }));

    expect(text).toContain('Control de stock (sin ajustes)');
    expect(text.join(' ')).toContain('sin motivo declarado');
  });

  test('pagina las diferencias cuando no entran en una hoja', async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      code: `AAA${String(index).padStart(3, '0')}`,
      name: `Producto ${index}`,
      systemStock: 10,
      countedStock: 9,
      difference: -1,
      decision: 'ACCEPTED' as const,
    }));

    const { doc, text } = await readPdf(await generateStockControlPdf({
      ...receipt, items, adjustedCount: 60, pendingCount: 0,
    }));

    expect(doc.getPageCount()).toBeGreaterThan(1);
    // El pie numera la última hoja con el total real de hojas.
    expect(text).toContain(`Página ${doc.getPageCount()} de ${doc.getPageCount()}`);
  });
});
