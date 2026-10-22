/** @jest-environment node */
import type { StockControlReceipt } from '@/lib/stock-control-receipt';
import { readPdfContent as readPdf } from '@/lib/fonts/pdf-test-reader';
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

  test('pinta el título con el rosa de marca y el encabezado de tabla en blanco', async () => {
    const { colors } = await readPdf(await generateStockControlPdf(receipt));

    // #be185d = rgb(0,75 · 0,09 · 0,36): el rosa de marca del sistema; el encabezado va en blanco encima.
    expect(colors.get('Ajuste de stock')).toEqual([0.75, 0.09, 0.36]);
    expect(colors.get('Código')).toEqual([1, 1, 1]);
  });

  test('embebe Poppins Regular y SemiBold en lugar de Helvetica', async () => {
    const { fonts } = await readPdf(await generateStockControlPdf(receipt));

    expect(fonts.join(' ')).toContain('Poppins-Regular');
    expect(fonts.join(' ')).toContain('Poppins-SemiBold');
    expect(fonts.join(' ')).not.toContain('Helvetica');
  });
});
