/**
 * @jest-environment jsdom
 */

/**
 * El historial del producto tiene que mostrar los movimientos de sucursal
 * (transferencias y ajustes), no solo compras y ventas (bug 10.1 del usuario).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MovementsModal } from './MovementsModal';

jest.mock('@/app/actions/product', () => ({
  getProductMovements: jest.fn(),
}));

import { getProductMovements } from '@/app/actions/product';

const mockGetProductMovements = getProductMovements as jest.MockedFunction<
  typeof getProductMovements
>;

const producto = { id: 1, name: 'Producto A', code: 'PR001' };

const renderModal = () =>
  render(<MovementsModal product={producto} isOpen onClose={jest.fn()} />);

const responder = (movimientos: unknown[]) =>
  mockGetProductMovements.mockResolvedValue({ success: true, data: movimientos } as never);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MovementsModal con movimientos de sucursal', () => {
  it('muestra la transferencia y el ajuste con su tipo, cantidad, sucursal y referencia', async () => {
    responder([
      {
        id: 'movement-1',
        type: 'TRANSFER_OUT',
        date: '2026-10-15T10:00:00.000Z',
        quantity: 3,
        referenceId: null,
        reference: 'MOVE-123',
        branchName: 'Centro',
      },
      {
        id: 'movement-2',
        type: 'ADJUSTMENT',
        date: '2026-10-14T10:00:00.000Z',
        quantity: 7,
        referenceId: null,
        reference: 'ADJUSTMENT',
        branchName: 'Principal',
      },
    ]);

    renderModal();

    await waitFor(() =>
      expect(screen.getByText('Transferencia salida')).toBeInTheDocument()
    );
    expect(screen.getByText('3 uds')).toBeInTheDocument();
    expect(screen.getByText('Centro')).toBeInTheDocument();
    expect(screen.getByText('MOVE-123')).toBeInTheDocument();

    expect(screen.getByText('Ajuste')).toBeInTheDocument();
    expect(screen.getByText('7 uds')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('sigue mostrando compras y ventas, con su referencia', async () => {
    responder([
      {
        id: 'purchase-12',
        type: 'PURCHASE',
        date: '2026-10-15T10:00:00.000Z',
        quantity: 5,
        referenceId: 12,
        reference: null,
        branchName: 'Centro',
      },
      {
        id: 'sale-4',
        type: 'SALE',
        date: '2026-10-14T10:00:00.000Z',
        quantity: 2,
        referenceId: 4,
        reference: null,
        branchName: 'Centro',
      },
    ]);

    renderModal();

    await waitFor(() => expect(screen.getByText('Compra')).toBeInTheDocument());
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });
});
