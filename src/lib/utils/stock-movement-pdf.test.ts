/** @jest-environment node */
import { PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';
import { readPdfContent as readPdf } from '@/lib/fonts/pdf-test-reader';
import { generateStockMovementPdf } from './stock-movement-pdf';

const receipt: StockMovementReceipt = {
  movementType: 'ENTRY', date: '2026-08-06T18:30:00.000Z',
  branchName: 'Sucursal Centro', branchCode: 'CEN', reference: 'Conteo físico',
  rows: [{ code: 'PR001', name: 'Producto de prueba', quantity: 3, stock: 17, price: 1250, sourceStock: 22 }],
};

describe('generateStockMovementPdf', () => {
  test.each(['ENTRY', 'EXIT', 'TRANSFER'] as const)('imprime %s con datos confirmados y precio unitario', async (movementType) => {
    const { doc, text, colors } = await readPdf(await generateStockMovementPdf({
      ...receipt, movementType, sourceBranchName: 'Depósito', sourceBranchCode: 'DEP',
    }));
    expect(text).toContain({ ENTRY: 'Ingreso', EXIT: 'Egreso', TRANSFER: 'Movimiento de sucursal' }[movementType]);
    expect(text.join(' ')).toContain('Sucursal Centro (CEN)');
    expect(text.join(' ')).toContain('06/08/2026');
    expect(text.join(' ')).toContain('15:30');
    expect(text.join(' ')).toContain('Conteo físico');
    if (movementType === 'TRANSFER') {
      expect(text.join(' ')).toContain('Depósito (DEP)');
      expect(text.join(' ')).toContain('Comprobante de la sucursal que recibe: Sucursal Centro (CEN)');
    }
    const row = text.indexOf('PR001');
    // S6/S7: la cantidad lleva signo y color según el tipo y el lado; el resto de las columnas queda en tinta.
    const signed = { ENTRY: '+3', EXIT: '-3', TRANSFER: '+3' }[movementType];
    expect(text.slice(row, row + 5)).toEqual(['PR001', 'Producto de prueba', signed, '17', '$1.250,00']);
    expect(colors.get(signed)).toEqual({ ENTRY: [0.08, 0.5, 0.24], EXIT: [0.86, 0.15, 0.15], TRANSFER: [0.08, 0.5, 0.24] }[movementType]);
    expect(colors.get('17')).toEqual([0.13, 0.13, 0.13]);
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

  test('el comprobante de la sucursal que envía muestra el saldo que le queda al origen', async () => {
    const { text, colors } = await readPdf(await generateStockMovementPdf({
      ...receipt, movementType: 'TRANSFER', sourceBranchName: 'Depósito', sourceBranchCode: 'DEP',
    }, 'SOURCE'));
    const row = text.indexOf('PR001');
    expect(text.slice(row, row + 5)).toEqual(['PR001', 'Producto de prueba', '-3', '22', '$1.250,00']);
    expect(colors.get('-3')).toEqual([0.86, 0.15, 0.15]);
    expect(colors.get('22')).toEqual([0.13, 0.13, 0.13]);
    expect(text.join(' ')).toContain('Comprobante de la sucursal que envía: Depósito (DEP)');
    expect(text.join(' ')).toContain('1 productos · 3 unidades');
  });

  test('el comprobante de la sucursal que envía exige el saldo de origen en vez de inventarlo', async () => {
    await expect(generateStockMovementPdf({
      ...receipt, movementType: 'TRANSFER', rows: [{ ...receipt.rows[0], sourceStock: undefined }],
    }, 'SOURCE')).rejects.toThrow('saldo de origen');
  });

  test('texto ingresado como HTML y caracteres no soportados no ejecutan código ni rompen el PDF', async () => {
    const { text } = await readPdf(await generateStockMovementPdf({
      ...receipt, reference: '<script>alert(1)</script> 📦',
    }));
    expect(text.join(' ')).toContain('<script>alert(1)</script> ?');
  });

  test('embebe Poppins Regular y SemiBold en lugar de Helvetica', async () => {
    const { fonts } = await readPdf(await generateStockMovementPdf(receipt));
    expect(fonts.join(' ')).toContain('Poppins-Regular');
    expect(fonts.join(' ')).toContain('Poppins-SemiBold');
    expect(fonts.join(' ')).not.toContain('Helvetica');
  });
});
