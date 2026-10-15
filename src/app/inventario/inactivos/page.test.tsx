/**
 * RTL test for la página de productos inactivos.
 *
 * El buscador no debe volver a pedir la lista al servidor en cada tecla: la lista
 * se carga una sola vez y el filtro se aplica localmente mientras el usuario escribe.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InactivosPage from './page';

const mockGetInactiveProducts = jest.fn();
const mockReactivateProduct = jest.fn();

jest.mock('@/app/actions/product', () => ({
  getInactiveProducts: (...args: unknown[]) => mockGetInactiveProducts(...args),
  reactivateProduct: (...args: unknown[]) => mockReactivateProduct(...args),
}));

jest.mock('sweetalert2', () => ({ fire: jest.fn() }));

const productos = [
  { id: 1, name: 'Producto Alfa', code: 'P-1', price: 100, category: null },
  { id: 2, name: 'Producto Beta', code: 'P-2', price: 200, category: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInactiveProducts.mockResolvedValue({ success: true, data: productos });
});

describe('InactivosPage', () => {
  it('carga la lista una sola vez y filtra localmente al escribir', async () => {
    render(<InactivosPage />);

    expect(await screen.findByText('Producto Alfa')).toBeInTheDocument();
    expect(screen.getByText('Producto Beta')).toBeInTheDocument();
    expect(mockGetInactiveProducts).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(/buscar producto/i), { target: { value: 'beta' } });

    await waitFor(() => expect(screen.queryByText('Producto Alfa')).not.toBeInTheDocument());
    expect(screen.getByText('Producto Beta')).toBeInTheDocument();
    // Escribir no vuelve a golpear el servidor.
    expect(mockGetInactiveProducts).toHaveBeenCalledTimes(1);
  });

  it('filtra también por código', async () => {
    render(<InactivosPage />);
    await screen.findByText('Producto Alfa');

    fireEvent.change(screen.getByLabelText(/buscar producto/i), { target: { value: 'P-2' } });

    await waitFor(() => expect(screen.queryByText('Producto Alfa')).not.toBeInTheDocument());
    expect(screen.getByText('Producto Beta')).toBeInTheDocument();
  });
});
