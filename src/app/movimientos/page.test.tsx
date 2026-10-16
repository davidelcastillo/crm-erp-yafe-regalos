/**
 * Test de la página de movimientos de stock.
 *
 * Fija que el listado muestre los movimientos cargados (producto, sucursal, tipo,
 * cantidad, referencia y responsable), que mientras carga se anuncie el estado con
 * el `Spinner` compartido en vez del vacío, y que un error del servidor se vea.
 */
import { render, screen } from '@testing-library/react';
import MovimientosPage from './page';

const mockGetBranchMovements = jest.fn();

jest.mock('@/app/actions/inventory', () => ({
  getBranchMovements: (...args: unknown[]) => mockGetBranchMovements(...args),
}));

// El encabezado compartido cierra sesión con la acción y navega con el router.
jest.mock('@/actions/auth', () => ({ logout: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const movimientos = [
  {
    id: 1,
    productId: 10,
    branchId: 2,
    movementType: 'ENTRY',
    quantity: 5,
    reference: 'OC-123',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    performedBy: 'Ana',
    branch: { id: 2, name: 'Sucursal Centro' },
    product: { id: 10, name: 'Producto Alfa' },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBranchMovements.mockResolvedValue({ success: true, data: movimientos });
});

describe('MovimientosPage', () => {
  it('muestra los movimientos cargados con su tipo y su cantidad', async () => {
    render(<MovimientosPage />);

    expect(await screen.findByText('Producto Alfa')).toBeInTheDocument();
    expect(mockGetBranchMovements).toHaveBeenCalledWith({});

    // El tipo y la cantidad se siguen leyendo tal cual vienen del movimiento.
    expect(screen.getByText('ENTRY')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument();
    expect(screen.getByText('OC-123')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('No hay movimientos')).not.toBeInTheDocument();
  });

  it('mientras carga anuncia el estado con el Spinner, sin mostrar el vacío', () => {
    mockGetBranchMovements.mockReturnValue(new Promise(() => {}));

    render(<MovimientosPage />);

    expect(screen.getByRole('status', { name: 'Cargando movimientos...' })).toBeInTheDocument();
    expect(screen.queryByText('No hay movimientos')).not.toBeInTheDocument();
  });

  it('muestra el error del servidor cuando falla la carga, sin el vacío encima', async () => {
    mockGetBranchMovements.mockResolvedValue({ success: false, error: 'No se pudo conectar' });

    render(<MovimientosPage />);

    // Con el error no se muestra además «No hay movimientos»: serían dos mensajes
    // contradictorios para la misma pantalla.
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
    expect(screen.queryByText('No hay movimientos')).not.toBeInTheDocument();
  });
});
