/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StockMovementReceiptPanel } from './StockMovementReceiptPanel';
import { generateStockMovementPdf } from '@/lib/utils/stock-movement-pdf';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';

jest.mock('@/lib/utils/stock-movement-pdf', () => ({ generateStockMovementPdf: jest.fn() }));
const generate = generateStockMovementPdf as jest.MockedFunction<typeof generateStockMovementPdf>;
const receipt: StockMovementReceipt = {
  movementType: 'EXIT', date: '2026-08-06T18:30:00.000Z', branchName: 'Centro', branchCode: 'CEN',
  reference: 'Rotura', rows: [{ code: 'PR001', name: 'Producto', quantity: 3, stock: 0, price: 25 }],
};
const transfer: StockMovementReceipt = {
  ...receipt, movementType: 'TRANSFER', reference: 'MOVE-1',
  sourceBranchName: 'Depósito', sourceBranchCode: 'DEP',
  rows: [{ code: 'PR001', name: 'Producto', quantity: 3, stock: 12, price: 25, sourceStock: 5 }],
};
let click: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  generate.mockResolvedValue(new Uint8Array([1, 2, 3]));
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
