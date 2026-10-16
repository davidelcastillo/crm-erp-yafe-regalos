/**
 * La página de compras tiene que ofrecer TODOS los productos activos al cargar
 * una compra, no solo los que ya tienen fila de inventario en la sucursal que se
 * usa para filtrar el listado (bug 2 del usuario: «para compras si listar todos
 * los productos (excepto de los que estan desactivados)»).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComprasPage from './page';

const mockGetProducts = jest.fn();
const mockGetPurchases = jest.fn();

jest.mock('../actions/product', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
}));

jest.mock('../actions/purchase', () => ({
  getPurchases: (...args: unknown[]) => mockGetPurchases(...args),
}));

jest.mock('./components/PurchasesList', () => ({ PurchasesList: () => null }));
jest.mock('./components/AddPurchaseButton', () => ({ AddPurchaseButton: () => null }));
jest.mock('@/lib/hooks/useReloadKey', () => ({ useReloadKey: () => [0, jest.fn()] }));

// El encabezado compartido cierra sesión con la acción y navega con el router.
jest.mock('@/actions/auth', () => ({ logout: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/components/ui/BranchSelector', () => ({
  BranchSelector: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (id: number | null) => void;
  }) => (
    <select
      aria-label={label}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Todas</option>
      <option value="1">Principal</option>
    </select>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({ success: true, data: [] });
  mockGetPurchases.mockResolvedValue({ success: true, data: [] });
});

describe('ComprasPage', () => {
  it('carga todos los productos activos, sin filtrarlos por la sucursal elegida', async () => {
    render(<ComprasPage />);

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledWith());

    // El filtro de sucursal es para el listado de compras, no para los productos.
    fireEvent.change(await screen.findByLabelText('Filtrar por sucursal'), {
      target: { value: '1' },
    });

    await waitFor(() => expect(mockGetProducts).toHaveBeenLastCalledWith());
    expect(mockGetPurchases).toHaveBeenLastCalledWith({ branchId: 1 });
  });
});
