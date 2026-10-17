/**
 * La página de clientes conserva el listado y el estado vacío después del
 * cambio de estética. El encabezado compartido es parte de la estructura nueva
 * (banda de marca + hoja de vidrio), así que el título también se fija acá.
 *
 * No se prueba CSS ni responsive: solo que los datos cargados se vean y que la
 * página no se rompa sin datos.
 */
import { render, screen } from '@testing-library/react';
import type { Customer } from '@prisma/client';
import ClientesPage from './page';

const mockGetCustomers = jest.fn();

jest.mock('../actions/customer', () => ({
  getCustomers: (...args: unknown[]) => mockGetCustomers(...args),
  getCustomerById: jest.fn(),
  createCustomer: jest.fn(),
  registerPayment: jest.fn(),
  getCustomerHistory: jest.fn(),
}));

// El encabezado compartido cierra sesión con la acción y navega con el router.
jest.mock('@/actions/auth', () => ({ logout: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// El botón de alta usa SweetAlert; no se abre en estos casos.
jest.mock('sweetalert2', () => ({ fire: jest.fn() }));

const ana = {
  id: 1,
  name: 'Ana',
  surname: 'Pérez',
  totalBalance: 0,
} as unknown as Customer;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ClientesPage', () => {
  it('muestra el título y los clientes cargados', async () => {
    mockGetCustomers.mockResolvedValue({ success: true, data: [ana] });

    render(await ClientesPage());

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('no se rompe cuando no hay clientes', async () => {
    mockGetCustomers.mockResolvedValue({ success: true, data: [] });

    render(await ClientesPage());

    expect(
      screen.getByText('No hay clientes aún. Toca + para agregar uno.')
    ).toBeInTheDocument();
  });
});
