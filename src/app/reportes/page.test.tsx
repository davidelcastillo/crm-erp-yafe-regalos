/**
 * `/reportes` calcada de `polkalinas-html/sistema/reportes.html`: los cuatro KPIs,
 * las ventas por semana y por categoría, la dimensión nueva de estilos (ventas y
 * stock) y el top de clientas.
 *
 * `getReportes` se mockea: el action tiene su propia suite contra la base local
 * (`src/app/actions/reportes.test.ts`). El rango que la página le pasa sí se
 * verifica, porque es lo único que el período cambia.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReportesPage from './page';

const mockGetReportes = jest.fn();
const mockPush = jest.fn();

jest.mock('@/app/actions/reportes', () => ({
  getReportes: (...args: unknown[]) => mockGetReportes(...args),
}));

// El encabezado compartido cierra sesión con la acción y navega con el router.
jest.mock('@/actions/auth', () => ({ logout: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

// El selector de sucursal vive en el contexto de marca: acá solo navega.
jest.mock('@/lib/context/BranchContext', () => ({
  useBranch: () => ({ branchId: null, branches: [], ready: true, setBranchId: jest.fn() }),
}));

const REPORTES = {
  kpis: {
    ingresos: 845000,
    unidades: 70,
    ventas: 62,
    costo: 298000,
    itemsSinCosto: 0,
    ganancia: 547000,
    margen: 64.73,
    ticketPromedio: 13629.03,
  },
  semanas: [
    { semana: '2026-11-02', total: 200000, unidades: 20 },
    { semana: '2026-11-09', total: 645000, unidades: 50 },
  ],
  categorias: [
    { categoria: 'Second hand', total: 600000, unidades: 40 },
    { categoria: 'Sin categoría', total: 245000, unidades: 30 },
  ],
  estilos: [
    { estilo: 'Coquette', total: 500000, unidades: 35 },
    { estilo: 'Sin estilo', total: 345000, unidades: 35 },
  ],
  stockPorEstilo: [
    { estilo: 'Coquette', stock: 12.5 },
    { estilo: 'Sin estilo', stock: 4 },
  ],
  topClientas: [
    { cliente: 'Mica R.', compras: 6, total: 98500, ultimaCompra: '2026-11-20' },
  ],
};

const VACIO = {
  kpis: {
    ingresos: 0,
    unidades: 0,
    ventas: 0,
    costo: 0,
    itemsSinCosto: 0,
    ganancia: 0,
    margen: 0,
    ticketPromedio: 0,
  },
  semanas: [],
  categorias: [],
  estilos: [],
  stockPorEstilo: [],
  topClientas: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetReportes.mockResolvedValue({ success: true, data: REPORTES });
});

/** `searchParams` de Next llega como promesa (Next 16). */
const abrir = async (params: Record<string, string> = {}) =>
  render(await ReportesPage({ searchParams: Promise.resolve(params) }));

describe('Reportes — encabezado', () => {
  it('titula «Clientas y reportes» con la aclaración de que es de la dueña', async () => {
    await abrir();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Clientas y reportes' })
    ).toBeInTheDocument();
    expect(screen.getByText('Solo la dueña ve costos y ganancias')).toBeInTheDocument();
  });

  it('pide «Este mes» por defecto, del día 1 a hoy', async () => {
    await abrir();

    const hoy = new Date();
    const clave = (fecha: Date) =>
      `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
        fecha.getDate()
      ).padStart(2, '0')}`;

    expect(mockGetReportes).toHaveBeenCalledWith(
      expect.objectContaining({
        desde: clave(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        hasta: clave(hoy),
      })
    );
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('«Mes anterior» pide el mes completo pasado y lo deja elegido', async () => {
    const hoy = new Date();
    const clave = (fecha: Date) =>
      `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
        fecha.getDate()
      ).padStart(2, '0')}`;

    await abrir({ periodo: 'anterior' });

    expect(mockGetReportes).toHaveBeenCalledWith(
      expect.objectContaining({
        desde: clave(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        // Día 0 del mes corriente = último del anterior.
        hasta: clave(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      })
    );
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('los tabs navegan con ?periodo= conservando la sucursal elegida', async () => {
    await abrir({ sucursal: '3' });

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 3 meses' }));
    expect(mockPush).toHaveBeenCalledWith('/reportes?periodo=tres&sucursal=3');

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(mockPush).toHaveBeenCalledWith('/reportes?periodo=anterior&sucursal=3');
  });

  it('filtra por la sucursal de la URL y la ignora si no es un id válido', async () => {
    await abrir({ sucursal: '3' });
    expect(mockGetReportes).toHaveBeenLastCalledWith(
      expect.objectContaining({ branchId: 3 })
    );

    mockGetReportes.mockClear();
    await abrir({ sucursal: 'las-rosas' });
    expect(mockGetReportes).toHaveBeenCalledWith(
      expect.not.objectContaining({ branchId: expect.anything() })
    );
  });

  it('«Últimos 3 meses» arranca el día 1 de dos meses atrás', async () => {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);

    await abrir({ periodo: 'tres' });

    expect(mockGetReportes).toHaveBeenCalledWith(
      expect.objectContaining({
        desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-01`,
      })
    );
  });
});

describe('Reportes — KPIs', () => {
  it('muestra los cuatro KPIs con sus valores y el margen', async () => {
    await abrir();

    expect(screen.getByText('Ingresos').parentElement).toHaveTextContent('$ 845.000');
    expect(screen.getByText('Costo de mercadería').parentElement).toHaveTextContent(
      '$ 298.000'
    );
    const ganancia = screen.getByText('Ganancia').parentElement;
    expect(ganancia).toHaveTextContent('$ 547.000');
    expect(ganancia).toHaveTextContent('margen 65 %');
    expect(screen.getByText('Ticket promedio').parentElement).toHaveTextContent(
      '$ 13.629'
    );
  });

  it('no avisa de ítems sin costo cuando no hay', async () => {
    await abrir();

    expect(screen.queryByText(/sin costo cargado/)).not.toBeInTheDocument();
  });

  it('avisa cuántos ítems quedaron sin costo cuando hay', async () => {
    mockGetReportes.mockResolvedValue({
      success: true,
      data: { ...REPORTES, kpis: { ...REPORTES.kpis, itemsSinCosto: 3 } },
    });

    await abrir();

    expect(screen.getByText('3 ítems sin costo cargado')).toBeInTheDocument();
  });
});

describe('Reportes — gráficos', () => {
  it('dibuja las semanas con el pico marcado y un aria-label que lo cuenta', async () => {
    await abrir();

    const grafico = screen.getByRole('img', { name: /Ventas por semana/ });
    expect(grafico).toHaveAccessibleName(/la semana más alta fue \$ 645\.000/);
    expect(within(grafico).getByText('Sem 1')).toBeInTheDocument();
    expect(within(grafico).getByText('Sem 2')).toBeInTheDocument();
  });

  it('lista categorías con su monto, incluida «Sin categoría»', async () => {
    await abrir();

    const panel = screen.getByRole('heading', { name: 'Por categoría' }).closest('section')!;
    expect(within(panel).getByText('Second hand')).toBeInTheDocument();
    expect(within(panel).getByText('$ 600.000')).toBeInTheDocument();
    expect(within(panel).getByText('Sin categoría')).toBeInTheDocument();
  });

  it('lista las ventas por estilo, con «Sin estilo» incluido', async () => {
    await abrir();

    const panel = screen.getByRole('heading', { name: 'Ventas por estilo' }).closest('section')!;
    expect(within(panel).getByText('Coquette')).toBeInTheDocument();
    expect(within(panel).getByText('$ 500.000')).toBeInTheDocument();
    expect(within(panel).getByText('Sin estilo')).toBeInTheDocument();
  });

  it('muestra el stock por estilo que devuelve el action', async () => {
    await abrir();

    const panel = screen.getByRole('heading', { name: 'Stock por estilo' }).closest('section')!;
    expect(within(panel).getByText('Coquette')).toBeInTheDocument();
    expect(within(panel).getByText('12,5 u.')).toBeInTheDocument();
  });

  it('omite la tarjeta de stock si el action no la devuelve', async () => {
    mockGetReportes.mockResolvedValue({
      success: true,
      data: { ...REPORTES, stockPorEstilo: undefined },
    });

    await abrir();

    expect(screen.queryByRole('heading', { name: 'Stock por estilo' })).not.toBeInTheDocument();
  });
});

describe('Reportes — top clientas', () => {
  it('lista clienta, compras, total y última compra', async () => {
    await abrir();

    const panel = screen.getByRole('heading', { name: 'Clientas que más compran' }).closest(
      'section'
    )!;
    // En el celular cada clienta es una tarjeta: el mismo dato aparece dos veces.
    expect(within(panel).getAllByText('Mica R.').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('6').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('$ 98.500').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('20/11').length).toBeGreaterThan(0);
  });
});

describe('Reportes — sin datos', () => {
  it('deja estados vacíos breves en vez de tarjetas en blanco', async () => {
    mockGetReportes.mockResolvedValue({ success: true, data: VACIO });

    await abrir();

    expect(screen.getByText('Todavía no hay ventas en el período.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay compras de clientas.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Ventas por semana/ })).not.toBeInTheDocument();
  });

  it('no se rompe si el action falla', async () => {
    mockGetReportes.mockResolvedValue({ success: false, error: 'Error al obtener los reportes' });

    await abrir();

    expect(
      screen.getByText('No se pudieron cargar los reportes. Probá de nuevo.')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clientas y reportes' })).toBeInTheDocument();
  });
});
