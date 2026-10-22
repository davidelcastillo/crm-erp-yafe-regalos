/**
 * RTL test for la página de productos inactivos.
 *
 * El buscador no debe volver a pedir la lista al servidor en cada tecla: la lista
 * se carga una sola vez y el filtro se aplica localmente mientras el usuario escribe.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('mientras carga muestra la ruedita compartida en lugar de la lista', async () => {
    // Promesa que nunca resuelve: deja la página en el estado de carga.
    mockGetInactiveProducts.mockReturnValue(new Promise(() => {}));

    render(<InactivosPage />);

    // La ruedita compartida anuncia el estado (role=status) con su etiqueta.
    expect(screen.getByRole('status')).toHaveAccessibleName(/cargando inactivos/i);
    expect(screen.queryByText('Producto Alfa')).not.toBeInTheDocument();
  });

  it('deja «Volver a inventario» también en el menú ☰ del celular', async () => {
    render(<InactivosPage />);
    await screen.findByText('Producto Alfa');

    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));

    const menu = screen.getByRole('dialog', { name: /menú de productos inactivos/i });
    expect(within(menu).getByRole('link', { name: 'Volver a inventario' })).toHaveAttribute(
      'href',
      '/inventario'
    );
  });

  // Prueba visual del usuario (S18, U3): «pongamos un boton de volver a inventario
  // en /inactivos y que no este oculto en la hamburgesa ese boton par voler».
  it('ofrece el regreso a la vista arriba de la hoja, sin abrir el menú ☰', async () => {
    render(<InactivosPage />);
    await screen.findByText('Producto Alfa');

    const volver = screen.getByRole('link', { name: 'Volver a inventario' });

    expect(volver).toHaveAttribute('href', '/inventario');
    // Mismo patrón que /inventario/control: target táctil de 44 px y sin target.
    expect(volver).toHaveClass('min-h-[44px]', 'inline-flex', 'items-center');
    // Vive arriba de la hoja de vidrio de la lista, no dentro de un overlay.
    expect(volver.closest('.glass')).not.toBeNull();
    expect(within(volver.closest('.glass') as HTMLElement).queryByRole('dialog')).toBeNull();

    // Y no depende de abrir el menú: ya está en el documento antes de tocarlo.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // S4: por defecto se ordena por código y se puede pasar a última modificación.
  it('ordena por código por defecto y permite cambiar a última modificación', async () => {
    mockGetInactiveProducts.mockResolvedValue({
      success: true,
      data: [
        { id: 3, name: 'Producto Alfa', code: 'BBB888', price: 10, category: null, updatedAt: '2026-01-03T00:00:00.000Z' },
        { id: 2, name: 'Producto Zeta', code: 'AAA099', price: 20, category: null, updatedAt: '2026-01-02T00:00:00.000Z' },
        { id: 1, name: 'Producto Mmm', code: 'AAA001', price: 30, category: null, updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });

    render(<InactivosPage />);
    await screen.findByText('Producto Alfa');

    const nombres = () =>
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

    expect(nombres()).toEqual(['Producto Mmm', 'Producto Zeta', 'Producto Alfa']);

    fireEvent.click(screen.getByRole('button', { name: 'Última modificación' }));

    expect(nombres()).toEqual(['Producto Alfa', 'Producto Zeta', 'Producto Mmm']);
  });

  it('filtra también por código', async () => {
    render(<InactivosPage />);
    await screen.findByText('Producto Alfa');

    fireEvent.change(screen.getByLabelText(/buscar producto/i), { target: { value: 'P-2' } });

    await waitFor(() => expect(screen.queryByText('Producto Alfa')).not.toBeInTheDocument());
    expect(screen.getByText('Producto Beta')).toBeInTheDocument();
  });
});

describe('InactivosPage — buscador en su propia tarjeta (S16)', () => {
  it('el buscador vive en una tarjeta de vidrio propia, fuera de la hoja de la lista', async () => {
    render(<InactivosPage />);

    const buscador = await screen.findByLabelText(/buscar producto/i);
    // Su bloque es el de vidrio reforzado, separado del que contiene las cards.
    expect(buscador.closest('.glass-strong')).not.toBeNull();
    expect(buscador.closest('[class*="rounded-t-"]')).toBeNull();
  });
});
