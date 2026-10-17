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
  expect(generate).toHaveBeenCalledWith(receipt);
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toMatch(/^comprobante-egreso-CEN-.*\.pdf$/);
  expect(document.querySelector('a')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar comprobante' }));
  expect(onClose).toHaveBeenCalledTimes(1);
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
  expect(generate).toHaveBeenNthCalledWith(2, receipt);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
