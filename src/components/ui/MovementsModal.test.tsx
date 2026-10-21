/**
 * @jest-environment jsdom
 */

/**
 * El historial del producto tiene que mostrar los movimientos de sucursal
 * (transferencias y ajustes), no solo compras y ventas (bug 10.1 del usuario).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('no cierra al tocar el fondo del modal', async () => {
    // S2: el click afuera no cierra los modales con datos, para no perder lo cargado.
    responder([]);
    const onClose = jest.fn();
    render(<MovementsModal product={producto} isOpen onClose={onClose} />);
    await waitFor(() => expect(mockGetProductMovements).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

// Layout: la lista es cronológica y de una sola cosa, así que solo el panel se
// acota desde `md` (`STYLE.md`, «Modales en escritorio»).
describe('MovementsModal — layout de escritorio', () => {
  it('acota el panel y lo centra desde `md`, sin tocar la columna de celular', () => {
    const { container } = renderModal();

    const panel = container.querySelector('[class*="md:max-w-2xl"]');
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass(
      'max-w-xl',
      'max-h-[90vh]',
      'md:max-h-[85vh]',
      'md:rounded-b-3xl'
    );
    expect(screen.getByRole('dialog')).toHaveClass('md:items-center');
  });

  it('la cantidad va numérica y se alinea a la derecha desde `md`', async () => {
    responder([
      {
        id: 'movement-1',
        type: 'SALE',
        date: '2026-10-15T10:00:00.000Z',
        quantity: 3,
        referenceId: 4,
        reference: null,
        branchName: 'Centro',
      },
    ]);

    renderModal();

    expect(await screen.findByText('3 uds')).toHaveClass('tabular-nums', 'md:text-right');
  });
});
