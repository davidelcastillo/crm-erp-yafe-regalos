/**
 * El período elegido en el dashboard tiene que gobernar todo el tablero: las
 * tarjetas y también el gráfico. Antes el gráfico pedía siempre `days: 30` sin
 * importar lo que se eligiera (bug 5 del usuario).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from './page';

const mockGetStats = jest.fn();
const mockGetPerformanceData = jest.fn();
const mockGetProducts = jest.fn();

jest.mock('../actions/dashboard', () => ({
  getStats: (...args: unknown[]) => mockGetStats(...args),
  getPerformanceData: (...args: unknown[]) => mockGetPerformanceData(...args),
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

// DashboardCards no se mockea: hay un caso que fija el título y los valores de las tarjetas.
jest.mock('./components/ProductAnalytics', () => ({ ProductAnalytics: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStats.mockResolvedValue({ success: true, data: null });
  mockGetPerformanceData.mockResolvedValue({ success: true, data: [] });
  mockGetProducts.mockResolvedValue({ success: true, data: [] });
});

describe('DashboardPage — período del gráfico', () => {
  it('al elegir 90 días pide 90 días para el gráfico', async () => {
    render(<DashboardPage />);

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenCalledWith({ type: 'cierre', branchId: undefined })
    );

    // La página muestra el estado de carga hasta que resuelven los datos.
    fireEvent.click(await screen.findByRole('button', { name: '90 días' }));

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenLastCalledWith({ type: '90', branchId: undefined })
    );
  });

  it('con el rango personalizado pide las fechas elegidas y las muestra en el gráfico', async () => {
    render(<DashboardPage />);

    // La página muestra el estado de carga hasta que resuelven los datos.
    fireEvent.click(await screen.findByRole('button', { name: 'Personalizado' }));
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

    // El rótulo del gráfico sigue al filtro (el de las tarjetas y el del gráfico son el mismo).
    expect(screen.getByText(/Del 01\/10\/2026 al 15\/10\/2026/)).toBeInTheDocument();
  });

  it('con el rango personalizado incompleto no pide nada', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mockGetStats).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });

    expect(await screen.findByText(/Sin rango elegido/)).toBeInTheDocument();
    expect(mockGetStats).toHaveBeenCalledTimes(1);
    expect(mockGetPerformanceData).toHaveBeenCalledTimes(1);
  });
});

// Sistema de botones (`globals.css`): el período elegido del control segmentado
// va `btn-active` y los otros `btn-secondary`.
describe('DashboardPage — variantes del sistema de botones', () => {
  it('el período elegido va btn-active y el resto btn-secondary', async () => {
    render(<DashboardPage />);

    // Por defecto viene elegido el período del último cierre de caja.
    expect(await screen.findByRole('button', { name: 'Desde el último cierre' })).toHaveClass(
      'btn',
      'btn-active'
    );
    expect(screen.getByRole('button', { name: '30 días' })).toHaveClass('btn', 'btn-secondary');

    fireEvent.click(screen.getByRole('button', { name: '90 días' }));

    expect(screen.getByRole('button', { name: '90 días' })).toHaveClass('btn', 'btn-active');
    expect(screen.getByRole('button', { name: '30 días' })).toHaveClass('btn', 'btn-secondary');
  });
});

describe('DashboardPage — carga', () => {
  it('mientras carga usa la ruedita compartida y los esqueletos', () => {
    render(<DashboardPage />);

    // El estado de carga lo anuncia el Spinner compartido (role="status"),
    // no un spinner dibujado a mano por la página.
    expect(screen.getByRole('status', { name: 'Cargando dashboard...' })).toBeInTheDocument();
  });
});

// La forma del encabezado mientras carga (S2): sin ella la hoja salta al terminar.
describe('DashboardPage — esqueleto del encabezado (S2)', () => {
  it('mientras carga muestra la forma del encabezado y la reemplaza al terminar', async () => {
    const { container } = render(<DashboardPage />);

    // La píldora del encabezado, con la medida de la página real.
    expect(container.querySelector('[aria-hidden="true"] .h-\\[60px\\]')).not.toBeNull();
    // Y la hoja arranca donde arranca la de la página: `-mt-12 px-5 pt-6`.
    const hoja = container.querySelector('.glass');
    expect(hoja).toHaveClass('-mt-12', 'px-5', 'pt-6');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeInTheDocument();
  });
});

// Parallax del encabezado y retiro del degradé (S10, S11): lo que se atenúa es
// superficie decorativa, nunca un control.
describe('DashboardPage — parallax y obscuration (S10, S11)', () => {
  it('el degradé es una capa decorativa dentro de la banda y el encabezado va en su envoltorio', async () => {
    const { container } = render(<DashboardPage />);
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });

    const capa = container.querySelector('.brand-gradient');
    expect(capa).toHaveAttribute('aria-hidden', 'true');
    expect(capa).toHaveClass('pointer-events-none', 'absolute', 'inset-0');
    expect(capa?.parentElement).toHaveClass('relative', 'isolate');

    // El encabezado se mueve solo: no está pegado al mismo nodo que la capa.
    const encabezado = container.querySelector('header');
    expect(encabezado).not.toBeNull();
    expect(encabezado?.parentElement).not.toBe(capa?.parentElement);
  });
});

// Cascada del recorrido (S7) y cambio de valor (S9) en las tarjetas del resumen.
describe('DashboardPage — tarjetas del resumen (S7, S9)', () => {
  it('cada tarjeta va en su propio envoltorio y el monto queda en un solo nodo', async () => {
    mockGetStats.mockResolvedValueOnce({
      success: true,
      data: {
        totalIncome: 1500,
        totalExpense: 800,
        netProfit: 700,
        accountsReceivable: 250,
      },
    });

    render(<DashboardPage />);
    await screen.findByText('Ingresos');

    const grilla = screen.getByRole('heading', { name: 'Resumen' })
      .parentElement?.nextElementSibling as HTMLElement;
    expect(grilla.children).toHaveLength(4);

    // La raíz de la card no cambia: la que anima la entrada es el envoltorio.
    for (const envoltorio of Array.from(grilla.children)) {
      expect(envoltorio).not.toHaveClass('glass');
      expect(envoltorio.firstElementChild).toHaveClass('glass');
    }

    // El monto entra animado y sigue siendo un único nodo de texto.
    const monto = screen.getByText(/\$ 1\.500/);
    expect(monto.tagName).toBe('SPAN');
    expect(monto).toHaveClass('block');
    expect(monto.childNodes).toHaveLength(1);
  });
});

describe('DashboardPage — resumen', () => {
  it('muestra el título y las tarjetas con sus valores', async () => {
    mockGetStats.mockResolvedValueOnce({
      success: true,
      data: {
        totalIncome: 1500,
        totalExpense: 800,
        netProfit: 700,
        accountsReceivable: 250,
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Egresos')).toBeInTheDocument();
    expect(screen.getByText('Ganancia Neta')).toBeInTheDocument();
    expect(screen.getByText('Cobrar')).toBeInTheDocument();

    expect(screen.getByText(/\$ 1\.500/)).toBeInTheDocument();
    expect(screen.getByText(/\$ 800/)).toBeInTheDocument();
    expect(screen.getByText(/\$ 700/)).toBeInTheDocument();
    expect(screen.getByText(/\$ 250/)).toBeInTheDocument();
  });
});
