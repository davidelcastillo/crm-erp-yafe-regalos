/**
 * El gráfico de ingresos vs egresos tiene que mostrar el período que se elige en
 * el dashboard (bug 5 del usuario: «Agregar opción para mostrar el grafico de 7
 * dias, 1 mes, 3 meses o personalizado»). Antes recibía 30 días y recortaba a los
 * últimos 7 (`data.slice(-7)`), así que el rango no se podía cambiar.
 */
import { render, screen } from '@testing-library/react';
import { DashboardChart, toChartPoints } from './DashboardChart';

const punto = (date: string) => ({ date, income: 10, expense: 5 });

describe('toChartPoints', () => {
  it('no recorta los datos: 30 días son 30 puntos', () => {
    const datos = Array.from({ length: 30 }, (_, i) => punto(`2026-09-${String(i + 1).padStart(2, '0')}`));

    expect(toChartPoints(datos)).toHaveLength(30);
  });

  it('rotula cada día con su propio día, sin corrimiento', () => {
    // `new Date("2026-10-15")` es medianoche UTC: en hora local (UTC-3) cae el 14.
    const [primero] = toChartPoints([punto('2026-10-15')]);

    expect(primero.date).toBe('15/10');
    expect(primero.income).toBe(10);
  });
});

describe('DashboardChart', () => {
  it('nombra el rango que le pasa el dashboard', () => {
    render(<DashboardChart data={[punto('2026-10-15')]} rangeLabel="Últimos 90 días" />);

    expect(screen.getByText(/Últimos 90 días/)).toBeInTheDocument();
  });

  it('sin datos sigue nombrando el rango elegido', () => {
    render(<DashboardChart data={[]} rangeLabel="Del 01/10/2026 al 15/10/2026" />);

    expect(screen.getByText(/Del 01\/10\/2026 al 15\/10\/2026/)).toBeInTheDocument();
  });
});
