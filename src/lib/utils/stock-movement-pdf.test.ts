/** @jest-environment node */
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';
import { generateStockMovementPdf } from './stock-movement-pdf';

const receipt: StockMovementReceipt = {
  movementType: 'ENTRY', date: '2026-08-06T18:30:00.000Z',
  branchName: 'Sucursal Centro', branchCode: 'CEN', reference: 'Conteo físico',
  rows: [{ code: 'PR001', name: 'Producto de prueba', quantity: 3, stock: 17, price: 1250 }],
};

async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const text: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents?.asArray() ?? [];
    for (const ref of streams) {
      const stream = doc.context.lookup(ref) as PDFRawStream;
      const raw = inflateSync(stream.getContents()).toString('latin1');
      text.push(...[...raw.matchAll(/<([A-Fa-f0-9]+)> Tj/g)]
        .map((m) => Buffer.from(m[1], 'hex').toString('latin1')));
    }
  }
  return { doc, text };
}

describe('generateStockMovementPdf', () => {
  test.each(['ENTRY', 'EXIT', 'TRANSFER'] as const)('imprime %s con datos confirmados y precio unitario', async (movementType) => {
    const { doc, text } = await readPdf(await generateStockMovementPdf({
      ...receipt, movementType, sourceBranchName: 'Depósito', sourceBranchCode: 'DEP',
    }));
    expect(text).toContain({ ENTRY: 'Ingreso', EXIT: 'Egreso', TRANSFER: 'Movimiento de sucursal' }[movementType]);
    expect(text.join(' ')).toContain('Sucursal Centro (CEN)');
    expect(text.join(' ')).toContain('06/08/2026');
    expect(text.join(' ')).toContain('15:30');
    expect(text.join(' ')).toContain('Conteo físico');
    if (movementType === 'TRANSFER') expect(text.join(' ')).toContain('Depósito (DEP)');
    const row = text.indexOf('PR001');
    expect(text.slice(row, row + 5)).toEqual(['PR001', 'Producto de prueba', '3', '17', '$1.250,00']);
    expect(text.join(' ')).toContain('1 productos · 3 unidades');
    expect(text).toContain('Página 1 de 1');
    const objects = doc.getPages()[0].node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
    expect(objects?.entries().some(([, ref]) => {
      const object = doc.context.lookup(ref);
      return object instanceof PDFRawStream && String(object.dict.get(PDFName.of('Subtype'))) === '/Image';
    })).toBe(true);
  });

  test('pagina sin perder productos y conserva motivo largo en todas las páginas', async () => {
    const reference = 'Motivo '.repeat(28).trim();
    const rows = Array.from({ length: 80 }, (_, i) => ({ ...receipt.rows[0], code: `P${i}`, quantity: 1 }));
    const { doc, text } = await readPdf(await generateStockMovementPdf({ ...receipt, reference, rows }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    for (const row of rows) expect(text).toContain(row.code);
    expect(text.filter((t) => t === 'Ingreso')).toHaveLength(doc.getPageCount());
    expect(text.join(' ')).toContain('80 productos · 80 unidades');
    expect(text).toContain(`Página ${doc.getPageCount()} de ${doc.getPageCount()}`);
    expect(text.join(' ')).toContain('Motivo Motivo');
  });

  test('texto ingresado como HTML y caracteres no soportados no ejecutan código ni rompen el PDF', async () => {
    const { text } = await readPdf(await generateStockMovementPdf({
      ...receipt, reference: '<script>alert(1)</script> 📦',
    }));
    expect(text.join(' ')).toContain('<script>alert(1)</script> ?');
  });
});
