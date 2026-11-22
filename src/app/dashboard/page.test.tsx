/**
 * Home interna calcada de `polkalinas-html/sistema/panel.html`: encabezado con
 * «Nueva venta», cuatro KPIs, ventas por canal + últimas ventas, reservas por
 * cobrar + para enviar, y el top de estilos del período.
 *
 * Los datos salen de `getResumenPanel` (mockeada acá: el action tiene su propia
 * suite contra la base local) y el período sigue gobernando el gráfico.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DashboardPage from './page';

const mockGetResumenPanel = jest.fn();
const mockGetPerformanceData = jest.fn();
const mockGetProducts = jest.fn();

jest.mock('../actions/dashboard', () => ({
  getResumenPanel: (...args: unknown[]) => mockGetResumenPanel(...args),
  getPerformanceData: (...args: unknown[]) => mockGetPerformanceData(...args),
  // `ProductAnalytics` (S18) sigue al final del tablero y pide esto al elegir.
  getProductAnalytics: jest.fn(async () => ({ success: true, data: null })),
}));

jest.mock('../actions/product', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
}));

jest.mock('@/lib/context/BranchContext', () => ({
  useBranch: () => ({ branches: [] }),
}));

jest.mock('@/components/ui/BranchSelector', () => ({
  BranchSelector: () => null,
}));

jest.mock('./components/ProductAnalytics', () => ({ ProductAnalytics: () => null }));

/** Clave de día local, el formato en que el action entrega `venceEl`. */
const claveDeHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate()
  ).padStart(2, '0')}`;
};

const RESUMEN = {
  ventas: { monto: 845000, unidades: 70, cantidad: 62 },
  gastos: 315000,
  reservas: { cantidad: 5, saldo: 120000, vencenHoy: 2 },
  paraEnviar: { cantidad: 3, salenHoy: 1 },
  porCanal: [
    { canal: 'WhatsApp', monto: 354900, porcentaje: 42 },
    { canal: 'Instagram', monto: 236600, porcentaje: 28 },
  ],
  estilos: [
    { estilo: 'Coquette', total: 300000, unidades: 12 },
    { estilo: 'Sin estilo', total: 100000, unidades: 3 },
  ],
  reservasPorCobrar: [
    {
      id: 7,
      numero: 'V-0007',
      cliente: 'Mica R.',
      prenda: 'Pollera escocesa',
      venceEl: claveDeHoy(),
      saldo: 60000,
    },
  ],
  ultimasVentas: [
    {
      id: 1,
      fecha: '2026-11-20',
      cliente: 'Juli M.',
      prenda: 'Campera de jean',
      canal: 'WhatsApp',
      monto: 24000,
    },
    {
      id: 2,
      fecha: '2026-11-19',
      cliente: 'Sofi L.',
      prenda: 'Top seda',
      canal: 'Punto Rosa',
      monto: 12000,
    },
    {
      id: 3,
      fecha: '2026-11-19',
      cliente: 'Vale P.',
      prenda: 'Pollera jean',
      canal: 'Punto Rosa',
      monto: 18000,
    },
    {
      id: 4,
      fecha: '2026-11-18',
      cliente: 'Rochi G.',
      prenda: 'Blazer lino',
      canal: 'Instagram',
      monto: 30000,
    },
  ],
  paraEnviarLista: [
    {
      id: 9,
      numero: 'V-0009',
      cliente: 'Lu T.',
      prenda: 'Vestido lencero',
      envioEstado: 'ETIQUETA_LISTA',
    },
  ],
};

const resumenVacio = {
  ventas: { monto: 0, unidades: 0, cantidad: 0 },
  gastos: 0,
  reservas: { cantidad: 0, saldo: 0, vencenHoy: 0 },
  paraEnviar: { cantidad: 0, salenHoy: 0 },
  porCanal: [],
  estilos: [],
  reservasPorCobrar: [],
  ultimasVentas: [],
  paraEnviarLista: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetResumenPanel.mockResolvedValue({ success: true, data: RESUMEN });
  mockGetPerformanceData.mockResolvedValue({ success: true, data: [] });
  mockGetProducts.mockResolvedValue({ success: true, data: [] });
});

/** Espera a que la página termine de cargar (el saludo es el encabezado). */
const cargar = async () => {
  render(<DashboardPage />);
  await screen.findByRole('heading', { level: 1 });
};

describe('Dashboard — encabezado', () => {
  it('saluda, y ofrece sucursal y «Nueva venta» al mismo destino de siempre', async () => {
    await cargar();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Hola/);
    expect(screen.getByRole('link', { name: /Nueva venta/ })).toHaveAttribute(
      'href',
      '/ventas'
    );
  });

  it('pide el resumen del período por defecto (último cierre) sin sucursal', async () => {
    await cargar();

    await waitFor(() =>
      expect(mockGetResumenPanel).toHaveBeenCalledWith({ type: 'cierre', branchId: undefined })
    );
  });
});

describe('Dashboard — cuatro KPIs', () => {
  it('muestra ventas, gastos, reservas y envíos con sus datos', async () => {
    await cargar();

    expect(screen.getByText('Ventas del período')).toBeInTheDocument();
    expect(screen.getByText(/\$ 845\.000/)).toBeInTheDocument();
    expect(screen.getByText('62 ventas')).toBeInTheDocument();

    // La tarjeta de prendas disponibles se reemplazó por los gastos del período.
    expect(screen.getByText('Gastos del período')).toBeInTheDocument();
    expect(screen.getByText(/\$ 315\.000/)).toBeInTheDocument();
    expect(screen.queryByText('Prendas disponibles')).not.toBeInTheDocument();

    expect(screen.getByText('Reservas sin cobrar')).toBeInTheDocument();
    expect(screen.getByText('2 vencen hoy')).toBeInTheDocument();

    expect(screen.getByText('Pedidos para enviar')).toBeInTheDocument();
    expect(screen.getByText('1 sale hoy')).toBeInTheDocument();
  });
});

describe('Dashboard — ventas por canal', () => {
  it('lista cada canal con su porcentaje y su link a reportes', async () => {
    await cargar();

    const tarjeta = screen.getByRole('heading', { name: 'Ventas por canal' }).closest('section')!;

    expect(within(tarjeta).getByText('WhatsApp')).toBeInTheDocument();
    expect(within(tarjeta).getByText('42%')).toBeInTheDocument();
    expect(within(tarjeta).getByText('28%')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('link', { name: 'Ver reporte' })).toHaveAttribute(
      'href',
      '/reportes'
    );
  });
});

describe('Dashboard — reservas y envíos', () => {
  it('lista la reserva con clienta, prenda y vencimiento', async () => {
    await cargar();

    const tarjeta = screen
      .getByRole('heading', { name: 'Reservas por cobrar' })
      .closest('section')!;

    expect(within(tarjeta).getByText('Mica R.')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Pollera escocesa/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/vence hoy/)).toBeInTheDocument();
  });

  it('lista el pedido a enviar con su estado en palabras', async () => {
    await cargar();

    const tarjeta = screen.getByRole('heading', { name: 'Para enviar' }).closest('section')!;

    expect(within(tarjeta).getByText('Lu T.')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Vestido lencero/)).toBeInTheDocument();
    expect(within(tarjeta).getByText('Etiqueta lista')).toBeInTheDocument();
  });
});

describe('Dashboard — últimas ventas', () => {
  it('muestra clienta, prenda, canal y monto', async () => {
    await cargar();

    const tarjeta = screen.getByRole('heading', { name: 'Últimas ventas' }).closest('section')!;

    expect(within(tarjeta).getByText('Juli M.')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Campera de jean')).toBeInTheDocument();
    expect(within(tarjeta).getByText('WhatsApp')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/\$ 24\.000/)).toBeInTheDocument();
  });

  it('entran 4 ventas en la tarjeta', async () => {
    await cargar();

    const tarjeta = screen.getByRole('heading', { name: 'Últimas ventas' }).closest('section')!;

    expect(within(tarjeta).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('Dashboard — orden de las tarjetas', () => {
  it('últimas ventas sube a la primera fila, junto a ventas por canal', async () => {
    await cargar();

    const titulos = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent?.trim());
    const posicion = (titulo: string) => titulos.indexOf(titulo);

    expect(posicion('Ventas por canal')).toBeGreaterThanOrEqual(0);
    // Primera fila: canal y últimas ventas. Reservas por cobrar baja a la segunda.
    expect(posicion('Últimas ventas')).toBe(posicion('Ventas por canal') + 1);
    expect(posicion('Reservas por cobrar')).toBeGreaterThan(posicion('Últimas ventas'));
  });
});

describe('Dashboard — estilos del período', () => {
  it('muestra el top de estilos con su monto y el link a reportes', async () => {
    await cargar();

    const tarjeta = screen.getByRole('heading', { name: 'Estilos más vendidos' }).closest('section')!;

    expect(within(tarjeta).getByText('Coquette')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/\$ 300\.000/)).toBeInTheDocument();
    // Los productos sin estilos no se pierden: caen en «Sin estilo».
    expect(within(tarjeta).getByText('Sin estilo')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('link', { name: 'Ver reporte' })).toHaveAttribute(
      'href',
      '/reportes'
    );
  });
});

describe('Dashboard — listas vacías', () => {
  it('cada tarjeta sin datos muestra su estado vacío y la página no se rompe', async () => {
    mockGetResumenPanel.mockResolvedValue({ success: true, data: resumenVacio });

    await cargar();

    expect(screen.getByText('Sin ventas en el período.')).toBeInTheDocument();
    expect(screen.getByText('No hay reservas sin cobrar.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay ventas.')).toBeInTheDocument();
    expect(screen.getByText('No hay pedidos para enviar.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay estilos vendidos.')).toBeInTheDocument();
    expect(screen.getByText('Ninguna vence hoy')).toBeInTheDocument();
  });

  it('si el action falla, el tablero queda en estados vacíos', async () => {
    mockGetResumenPanel.mockResolvedValue({ success: false, error: 'sin sesión' });

    await cargar();

    expect(screen.getByText('Sin ventas en el período.')).toBeInTheDocument();
  });
});

describe('Dashboard — período del gráfico', () => {
  it('al elegir 90 días pide 90 días para el gráfico y el resumen', async () => {
    await cargar();

    fireEvent.click(screen.getByRole('button', { name: '90 días' }));

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenLastCalledWith({
        type: '90',
        branchId: undefined,
      })
    );
    expect(mockGetResumenPanel).toHaveBeenLastCalledWith({ type: '90', branchId: undefined });
  });

  it('con el rango personalizado pide las fechas elegidas y las rotula', async () => {
    await cargar();

    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenLastCalledWith({
        type: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
        branchId: undefined,
      })
    );
    expect(screen.getByText(/Del 01\/10\/2026 al 15\/10\/2026/)).toBeInTheDocument();
  });
});

describe('Dashboard — carga', () => {
  it('mientras carga usa la ruedita compartida', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('status', { name: 'Cargando dashboard...' })).toBeInTheDocument();
  });

  it('el esqueleto de carga usa la banda de marca y la hoja glass', () => {
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('.brand-gradient')).not.toBeNull();
    expect(container.querySelector('.glass')).not.toBeNull();
  });
});
