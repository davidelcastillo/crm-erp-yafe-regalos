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
      expect(mockGetPerformanceData).toHaveBeenCalledWith({ days: 30, branchId: undefined })
    );

    // La página muestra el estado de carga hasta que resuelven los datos.
    fireEvent.click(await screen.findByRole('button', { name: '90 días' }));

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenLastCalledWith({ days: 90, branchId: undefined })
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

describe('DashboardPage — carga', () => {
  it('mientras carga usa la ruedita compartida y los esqueletos', () => {
    render(<DashboardPage />);

    // El estado de carga lo anuncia el Spinner compartido (role="status"),
    // no un spinner dibujado a mano por la página.
    expect(screen.getByRole('status', { name: 'Cargando dashboard...' })).toBeInTheDocument();
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
