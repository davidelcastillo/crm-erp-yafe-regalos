/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StockMovementReceiptPanel } from './StockMovementReceiptPanel';
import { generateStockMovementPdf } from '@/lib/utils/stock-movement-pdf';
import { generateEntryReceiptWithLabels, detectPrendaProducts } from '@/actions/label-print';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';

jest.mock('@/lib/utils/stock-movement-pdf', () => ({ generateStockMovementPdf: jest.fn() }));
jest.mock('@/actions/label-print', () => ({
  generateEntryReceiptWithLabels: jest.fn(),
  detectPrendaProducts: jest.fn(),
}));
const generate = generateStockMovementPdf as jest.MockedFunction<typeof generateStockMovementPdf>;
const combined = generateEntryReceiptWithLabels as jest.MockedFunction<typeof generateEntryReceiptWithLabels>;
const detect = detectPrendaProducts as jest.MockedFunction<typeof detectPrendaProducts>;
const receipt: StockMovementReceipt = {
  movementType: 'EXIT', branchId: 3, date: '2026-08-06T18:30:00.000Z', branchName: 'Centro', branchCode: 'CEN',
  reference: 'Rotura', rows: [{ productId: 1, code: 'PR001', name: 'Producto', quantity: 3, stock: 0, price: 25 }],
};
const transfer: StockMovementReceipt = {
  ...receipt, movementType: 'TRANSFER', reference: 'MOVE-1',
  sourceBranchName: 'Depósito', sourceBranchCode: 'DEP',
  rows: [{ productId: 1, code: 'PR001', name: 'Producto', quantity: 3, stock: 12, price: 25, sourceStock: 5 }],
};
const entry: StockMovementReceipt = {
  ...receipt, movementType: 'ENTRY', reference: 'Conteo físico',
  rows: [{ productId: 1, code: 'PR001', name: 'Producto', quantity: 3, stock: 17, price: 25 }],
};
let click: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  generate.mockResolvedValue(new Uint8Array([1, 2, 3]));
  combined.mockResolvedValue({
    success: true,
    data: {
      pdfBase64: Buffer.from([1, 2, 3]).toString('base64'),
      filename: 'comprobante-ingreso-CEN-20260806-etiquetas.pdf',
    },
  });
  // Por defecto lo ingresado no trae prendas: el panel no suma pasos.
  detect.mockResolvedValue({ success: true, data: { prendaIds: [] } });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:receipt');
  URL.revokeObjectURL = jest.fn();
  click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => click.mockRestore());

it('descarga solo al pedirlo y permite cerrar sin acciones de stock', async () => {
  const onClose = jest.fn();
  render(<StockMovementReceiptPanel receipt={receipt} onClose={onClose} />);
  expect(generate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(generate).toHaveBeenCalledWith(receipt, 'DESTINATION');
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toMatch(/^comprobante-egreso-CEN-.*\.pdf$/);
  expect(document.querySelector('a')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar comprobante' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('con etiquetas disponibles el comprobante combinado es la acción principal', () => {
  render(<StockMovementReceiptPanel receipt={receipt} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Comprobante + etiquetas' })).toHaveClass('btn-primary');
  expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toHaveClass('btn-secondary');
  expect(screen.getByRole('button', { name: 'Cerrar comprobante' })).toHaveClass('btn-secondary');
});

it('un traslado descarga el comprobante de la sucursal que recibe y el de la que envía', async () => {
  render(<StockMovementReceiptPanel receipt={transfer} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobante de la sucursal que envía' }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(generate).toHaveBeenCalledWith(transfer, 'SOURCE');
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toMatch(/^comprobante-traslado-origen-DEP-.*\.pdf$/);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobante de la sucursal que recibe' }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
  expect(generate).toHaveBeenNthCalledWith(2, transfer, 'DESTINATION');
  expect((click.mock.instances[1] as HTMLAnchorElement).download).toMatch(/^comprobante-traslado-destino-CEN-.*\.pdf$/);
});

it('distingue un fallo del PDF de la operación exitosa y reintenta el mismo snapshot', async () => {
  generate.mockRejectedValueOnce(new Error('PDF unavailable'));
  render(<StockMovementReceiptPanel receipt={receipt} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El movimiento ya se registró');
  expect(screen.getByRole('alert')).toHaveTextContent('Reintentá la descarga sin repetir la operación');
  expect(click).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(generate).toHaveBeenNthCalledWith(2, receipt, 'DESTINATION');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

// S2/S3: solo el ingreso ofrece las etiquetas de lo que se acaba de ingresar.
describe('ingreso registrado', () => {
  it('ofrece comprobante con etiquetas como acción principal, después el comprobante suelto y cerrar', () => {
    render(<StockMovementReceiptPanel receipt={entry} onClose={jest.fn()} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Comprobante + etiquetas',
      'Descargar comprobante',
      'Cerrar comprobante',
    ]);
    // S16: la jerarquía es condicional; con etiquetas disponibles, el principal es el combinado.
    expect(screen.getByRole('button', { name: 'Comprobante + etiquetas' })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toHaveClass('btn-secondary');
    expect(screen.getByRole('button', { name: 'Cerrar comprobante' })).toHaveClass('btn-secondary');
  });

  it('descarga el PDF combinado que arma el servidor, sin volver a pedir el comprobante suelto', async () => {
    render(<StockMovementReceiptPanel receipt={entry} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(combined).toHaveBeenCalledWith(entry);
    expect(generate).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe('comprobante-ingreso-CEN-20260806-etiquetas.pdf');
  });

  it('avisa cuando el servidor no puede agregar las etiquetas y deja reintentar', async () => {
    combined.mockResolvedValueOnce({
      success: false,
      error: 'Hay productos inactivos o sin stock en la sucursal seleccionada',
    });
    render(<StockMovementReceiptPanel receipt={entry} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El movimiento ya se registró, pero no se pudo generar el PDF'
    );
    expect(click).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el egreso ofrece comprobante con etiquetas como acción principal', () => {
    render(<StockMovementReceiptPanel receipt={receipt} onClose={jest.fn()} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Comprobante + etiquetas',
      'Descargar comprobante',
      'Cerrar comprobante',
    ]);
  });

  it('el egreso con prendas pregunta el tamaño y descarga el PDF combinado', async () => {
    const egresoConPrenda: StockMovementReceipt = {
      ...receipt,
      rows: [
        { productId: 1, code: 'AAA001', name: 'Jabón de Avena', quantity: 2, stock: 4, price: 1250 },
        { productId: 7, code: 'RPH014', name: 'Body Rosa', quantity: 1, stock: 3, price: 24000 },
      ],
    };
    detect.mockResolvedValue({ success: true, data: { prendaIds: [7] } });
    render(<StockMovementReceiptPanel receipt={egresoConPrenda} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));

    await waitFor(() => expect(detect).toHaveBeenCalledWith({ productIds: [1, 7] }));
    expect(await screen.findByText(/tamaño de la etiqueta de prenda/i)).toBeInTheDocument();
    expect(combined).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /mediana 35 × 58 mm/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Generar PDF con etiquetas' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(combined).toHaveBeenCalledWith({ ...egresoConPrenda, prendaTamano: 'mediana' });
  });

  it('el traslado ofrece las etiquetas del lado que recibe y las genera con la detección', async () => {
    render(<StockMovementReceiptPanel receipt={transfer} onClose={jest.fn()} />);

    // El traslado sigue teniendo dos comprobantes: recibe, envía (y el combinado del que recibe).
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Comprobante de la sucursal que recibe + etiquetas',
      'Comprobante de la sucursal que recibe',
      'Comprobante de la sucursal que envía',
      'Cerrar comprobante',
    ]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Comprobante de la sucursal que recibe + etiquetas' })
    );

    await waitFor(() => expect(detect).toHaveBeenCalledWith({ productIds: [1] }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    // Sin prendas va derecho al combinado, que es el comprobante del lado que recibe.
    expect(combined).toHaveBeenCalledWith(transfer);
    expect(generate).not.toHaveBeenCalled();
  });
});

// Los pasos extra del ingreso: tamaño de la etiqueta de prenda y peluches.
describe('ingreso con prendas', () => {
  const entryConPrenda: StockMovementReceipt = {
    ...entry,
    rows: [
      { productId: 1, code: 'AAA001', name: 'Jabón de Avena', quantity: 2, stock: 17, price: 1250 },
      { productId: 7, code: 'RPH014', name: 'Body Rosa', quantity: 1, stock: 4, price: 24000 },
    ],
  };

  it('detecta la prenda, pregunta el tamaño y los peluches, y genera el PDF con ambos datos', async () => {
    detect.mockResolvedValue({ success: true, data: { prendaIds: [7] } });
    render(<StockMovementReceiptPanel receipt={entryConPrenda} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));

    await waitFor(() => expect(detect).toHaveBeenCalledWith({ productIds: [1, 7] }));
    expect(await screen.findByText(/tamaño de la etiqueta de prenda/i)).toBeInTheDocument();
    expect(combined).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /grande 50 × 80 mm/i }));
    // Solo los productos que no son prenda se pueden marcar como peluche.
    expect(screen.queryByRole('checkbox', { name: /body rosa/i })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /jabón de avena/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Generar PDF con etiquetas' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(combined).toHaveBeenCalledWith({
      ...entryConPrenda,
      prendaTamano: 'grande',
      pelucheIds: [1],
    });
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
      'comprobante-ingreso-CEN-20260806-etiquetas.pdf'
    );
  });

  it('volver del paso extra no imprime nada y deja reintentar', async () => {
    detect.mockResolvedValue({ success: true, data: { prendaIds: [7] } });
    render(<StockMovementReceiptPanel receipt={entryConPrenda} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));
    await screen.findByText(/tamaño de la etiqueta de prenda/i);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

    expect(combined).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Comprobante + etiquetas' })).toBeInTheDocument();
  });

  it('sin prendas el panel va derecho al PDF combinado, como hoy', async () => {
    render(<StockMovementReceiptPanel receipt={entryConPrenda} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante + etiquetas' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(detect).toHaveBeenCalledWith({ productIds: [1, 7] });
    expect(combined).toHaveBeenCalledWith(entryConPrenda);
  });
});
