/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StockMovementReceiptPanel } from './StockMovementReceiptPanel';
import { generateStockMovementPdf } from '@/lib/utils/stock-movement-pdf';
import { generateEntryReceiptWithLabels } from '@/actions/label-print';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';

jest.mock('@/lib/utils/stock-movement-pdf', () => ({ generateStockMovementPdf: jest.fn() }));
jest.mock('@/actions/label-print', () => ({ generateEntryReceiptWithLabels: jest.fn() }));
const generate = generateStockMovementPdf as jest.MockedFunction<typeof generateStockMovementPdf>;
const combined = generateEntryReceiptWithLabels as jest.MockedFunction<typeof generateEntryReceiptWithLabels>;
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

it('sin etiquetas disponibles, el botón principal sigue siendo descargar el comprobante', () => {
  render(<StockMovementReceiptPanel receipt={receipt} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toHaveClass('btn-primary');
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

  it('el egreso y el traslado no ofrecen etiquetas', () => {
    const { unmount } = render(<StockMovementReceiptPanel receipt={receipt} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Comprobante + etiquetas' })).toBeNull();
    unmount();

    render(<StockMovementReceiptPanel receipt={transfer} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Comprobante + etiquetas' })).toBeNull();
  });
});
