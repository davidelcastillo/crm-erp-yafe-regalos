/**
 * La página de categorías conserva el listado y el estado vacío después del
 * cambio de estética. El encabezado compartido es parte de la estructura nueva
 * (banda de marca + hoja de vidrio), así que el título también se fija acá.
 *
 * No se prueba CSS ni responsive: solo que los datos cargados se vean, que la
 * página no se rompa sin datos y que la carga se anuncie con el `Spinner`
 * compartido en vez de mostrar el vacío.
 */
import { render, screen } from '@testing-library/react';
import CategoriasPage from './page';

const mockGetCategories = jest.fn();

jest.mock('@/app/actions/category', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  createCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

// El encabezado compartido cierra sesión con la acción y navega con el router.
jest.mock('@/actions/auth', () => ({ logout: jest.fn() }));

// El alta y el borrado usan SweetAlert; no se abren en estos casos.
jest.mock('sweetalert2', () => ({ fire: jest.fn() }));

const limpieza = { id: 3, name: 'Limpieza', _count: { products: 2 } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CategoriasPage', () => {
  it('muestra las categorías cargadas con su cantidad de productos', async () => {
    mockGetCategories.mockResolvedValue({ success: true, data: [limpieza] });

    render(<CategoriasPage />);

    expect(await screen.findByText('Limpieza')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('No hay categorías')).not.toBeInTheDocument();
  });

  it('no se rompe cuando no hay categorías', async () => {
    mockGetCategories.mockResolvedValue({ success: true, data: [] });

    render(<CategoriasPage />);

    expect(await screen.findByText('No hay categorías')).toBeInTheDocument();
  });

  it('mientras carga anuncia el estado con el Spinner, sin mostrar el vacío', () => {
    mockGetCategories.mockReturnValue(new Promise(() => {}));

    render(<CategoriasPage />);

    expect(screen.getByRole('status', { name: 'Cargando categorías...' })).toBeInTheDocument();
    expect(screen.queryByText('No hay categorías')).not.toBeInTheDocument();
  });
});
