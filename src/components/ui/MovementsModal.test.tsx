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

/**
 * S4: el modal tiene el selector del rango y arranca en «desde el último
 * control» cuando la página sabe de qué sucursal habla; sin sucursal no hay
 * control contra el cual cortar, así que la opción queda deshabilitada y se
 * explica por qué.
 */
describe('MovementsModal — rango del historial', () => {
  const metaCreado = {
    range: 'created' as const,
    requestedRange: 'created' as const,
    since: '2026-01-10T12:00:00.000Z',
    controlClosedAt: null,
    branchId: null,
  };

  it('pide el rango «desde la creación» y deshabilita el control cuando no hay sucursal', async () => {
    mockGetProductMovements.mockResolvedValue({
      success: true,
      data: [],
      meta: metaCreado,
    } as never);

    renderModal();

    await waitFor(() =>
      expect(mockGetProductMovements).toHaveBeenCalledWith(1, { range: 'created', branchId: null })
    );

    const control = screen.getByRole('button', { name: 'Desde el último control' });
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Desde la creación' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByText('Elegí una sucursal en la página para ver desde su último control de stock.')
    ).toBeInTheDocument();
  })

  it('con sucursal pide «desde el último control» y muestra la fecha del control', async () => {
    mockGetProductMovements.mockResolvedValue({
      success: true,
      data: [],
      meta: {
        range: 'last-control',
        requestedRange: 'last-control',
        since: '2026-01-11T12:00:00.000Z',
        controlClosedAt: '2026-01-11T12:00:00.000Z',
        branchId: 7,
      },
    } as never);

    render(<MovementsModal product={producto} isOpen onClose={jest.fn()} branchId={7} />);

    await waitFor(() =>
      expect(mockGetProductMovements).toHaveBeenCalledWith(1, { range: 'last-control', branchId: 7 })
    );

    expect(screen.getByRole('button', { name: 'Desde el último control' })).toBeEnabled();
    expect(screen.getByText('Movimientos desde el control del 11/01/2026.')).toBeInTheDocument();
  })

  it('al cambiar de rango vuelve a pedir el historial con el otro corte', async () => {
    mockGetProductMovements.mockResolvedValue({
      success: true,
      data: [],
      meta: {
        range: 'created',
        requestedRange: 'last-control',
        since: '2026-01-10T12:00:00.000Z',
        controlClosedAt: null,
        branchId: 7,
      },
    } as never);

    render(<MovementsModal product={producto} isOpen onClose={jest.fn()} branchId={7} />);
    await waitFor(() =>
      expect(mockGetProductMovements).toHaveBeenCalledWith(1, { range: 'last-control', branchId: 7 })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desde la creación' }));

    await waitFor(() =>
      expect(mockGetProductMovements).toHaveBeenLastCalledWith(1, { range: 'created', branchId: 7 })
    );

    // Si la sucursal nunca tuvo control, el respaldo se avisa en vez de quedar mudo.
    await waitFor(() =>
      expect(
        screen.getByText('Movimientos desde la creación del producto (10/01/2026).')
      ).toBeInTheDocument()
    );
  })
})
