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

jest.mock('./components/DashboardCards', () => ({ DashboardCards: () => null }));
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

    fireEvent.click(screen.getByRole('button', { name: '90 días' }));

    await waitFor(() =>
      expect(mockGetPerformanceData).toHaveBeenLastCalledWith({ days: 90, branchId: undefined })
    );
  });

  it('con el rango personalizado pide las fechas elegidas y las muestra en el gráfico', async () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
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
