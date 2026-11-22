import type { ReactNode } from "react";
import { getReportes } from "@/app/actions/reportes";
import { BrandBand } from "@/components/ui/BrandBand";
import { PageHeader } from "@/components/ui/PageHeader";
import { toLocalDateKey, toShortLabel } from "@/lib/dates";
import { FiltrosReporte, PERIODOS, type Periodo } from "./components/FiltrosReporte";

export const dynamic = "force-dynamic";

/**
 * `/reportes`, calcada de `polkalinas-html/sistema/reportes.html`: es la única
 * pantalla donde se ven costos y ganancias, y donde las ventas se abren por
 * estilo (esa dimensión no estaba en el mockup).
 *
 * El período y la sucursal viven en la URL, así que la página es un Server
 * Component: `?periodo=mes|anterior|tres&sucursal=<id>`.
 */

type Fila = { total: number; unidades: number };

type Reportes = {
  kpis: {
    ingresos: number;
    unidades: number;
    ventas: number;
    costo: number;
    itemsSinCosto: number;
    ganancia: number;
    margen: number;
    ticketPromedio: number;
  };
  semanas: { semana: string; total: number; unidades: number }[];
  categorias: ({ categoria: string } & Fila)[];
  estilos: ({ estilo: string } & Fila)[];
  stockPorEstilo?: { estilo: string; stock: number }[];
  topClientas: { cliente: string; compras: number; total: number; ultimaCompra: string }[];
};

/** El número se escribe acá y no con `style: "currency"`: el espacio duro de
 * `es-AR` rompe los rótulos. Mismo criterio que `ResumenPanel`. */
const plata = (monto: number) =>
  `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(monto)}`;

const unidades = (cantidad: number) =>
  `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(cantidad)} u.`;

const plural = (cantidad: number, uno: string, varios: string) =>
  `${cantidad} ${cantidad === 1 ? uno : varios}`;

const leerPeriodo = (valor?: string): Periodo =>
  PERIODOS.find((periodo) => periodo.value === valor)?.value ?? "mes";

const leerSucursal = (valor?: string): number | null => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Rango local de cada período. El mes corriente llega hasta hoy, no hasta fin de mes. */
const rangoDe = (periodo: Periodo) => {
  const hoy = new Date();
  const dia = (mesesAtras: number, numero: number) =>
    toLocalDateKey(new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, numero));

  // Día 0 del mes corriente = último día del mes anterior.
  if (periodo === "anterior") return { desde: dia(1, 1), hasta: dia(0, 0) };
  return { desde: dia(periodo === "tres" ? 2 : 0, 1), hasta: toLocalDateKey(hoy) };
};

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="min-w-0 rounded-[18px] border border-hairline bg-surface p-5">
    <h2 className="mb-3 text-[17px] font-semibold text-ink">{title}</h2>
    {children}
  </section>
);

const Vacio = ({ children }: { children: ReactNode }) => (
  <p className="py-2 text-sm text-ink-muted">{children}</p>
);

const Kpi = ({
  label,
  valor,
  detalle,
  nota,
  rojo = false,
}: {
  label: string;
  valor: string;
  detalle: string;
  nota?: string;
  rojo?: boolean;
}) => (
  <div className="min-w-0 rounded-[18px] border border-hairline bg-surface p-4">
    <span className="block text-[13px] text-ink-muted">{label}</span>
    <b
      className={`block py-1.5 text-2xl font-semibold sm:text-3xl ${rojo ? "text-accent" : "text-ink"}`}
    >
      {valor}
    </b>
    <small className="block text-xs text-ink-muted">{detalle}</small>
    {nota && <small className="mt-1 block text-xs text-ink-muted">{nota}</small>}
  </div>
);

const Semanas = ({ semanas }: { semanas: Reportes["semanas"] }) => {
  if (semanas.length === 0) return <Vacio>Todavía no hay ventas en el período.</Vacio>;

  const pico = Math.max(...semanas.map((semana) => semana.total));

  return (
    <div
      className="flex h-[180px] items-end gap-4 pt-2.5"
      role="img"
      aria-label={`Ventas por semana: la semana más alta fue ${plata(pico)}`}
    >
      {semanas.map((semana, indice) => (
        <div
          key={semana.semana}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
        >
          <i
            className={`block w-full max-w-16 rounded-t-[10px] ${semana.total === pico ? "bg-accent" : "bg-ink"}`}
            style={{ height: `${pico > 0 ? Math.max(2, (semana.total / pico) * 100) : 0}%` }}
          />
          <span className="text-xs text-ink-muted">Sem {indice + 1}</span>
        </div>
      ))}
    </div>
  );
};

/** Pista fina con relleno cacao: la misma barra para categorías, estilos y stock. */
const Barras = ({
  filas,
  formato = plata,
}: {
  filas: { label: string; total: number }[];
  formato?: (valor: number) => string;
}) => {
  const maximo = Math.max(...filas.map((fila) => fila.total), 0);

  return (
    <div className="flex flex-col gap-3.5">
      {filas.map((fila) => (
        <div key={fila.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-sm text-ink">
            <span className="min-w-0 break-words">{fila.label}</span>
            <b className="shrink-0">{formato(fila.total)}</b>
          </div>
          <div className="h-2.5 rounded-full bg-surface-strong" aria-hidden="true">
            <i
              className="block h-full rounded-full bg-ink"
              style={{
                width: `${maximo > 0 ? Math.min(100, Math.max(2, (fila.total / maximo) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Tabla desde tablet; en el celular cada clienta es una tarjeta. */
const Clientas = ({ clientas }: { clientas: Reportes["topClientas"] }) => {
  if (clientas.length === 0) return <Vacio>Todavía no hay compras de clientas.</Vacio>;

  const celda = "border-b border-hairline px-2.5 py-2.5 text-sm";

  return (
    <>
      <table className="hidden w-full border-collapse sm:table">
        <thead>
          <tr>
            <th scope="col" className="border-b border-hairline px-2.5 py-3 text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
              Clienta
            </th>
            <th scope="col" className="border-b border-hairline px-2.5 py-3 text-right text-xs uppercase tracking-[0.08em] text-ink-muted">
              Compras
            </th>
            <th scope="col" className="border-b border-hairline px-2.5 py-3 text-right text-xs uppercase tracking-[0.08em] text-ink-muted">
              Total
            </th>
            <th scope="col" className="border-b border-hairline px-2.5 py-3 text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
              Última
            </th>
          </tr>
        </thead>
        <tbody>
          {clientas.map((clienta) => (
            <tr key={clienta.cliente}>
              <td className={`${celda} text-ink`}>{clienta.cliente}</td>
              <td className={`${celda} text-right text-ink-body`}>{clienta.compras}</td>
              <td className={`${celda} text-right font-semibold text-ink`}>
                {plata(clienta.total)}
              </td>
              <td className={`${celda} text-ink-muted`}>{toShortLabel(clienta.ultimaCompra)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-2 sm:hidden">
        {clientas.map((clienta) => (
          <li
            key={clienta.cliente}
            className="min-w-0 rounded-xl border border-hairline p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="min-w-0 break-words text-[15px] text-ink">
                {clienta.cliente}
              </strong>
              <b className="shrink-0 text-sm text-ink">{plata(clienta.total)}</b>
            </div>
            <small className="block text-[13px] text-ink-muted">
              {plural(clienta.compras, "compra", "compras")} · última{" "}
              {toShortLabel(clienta.ultimaCompra)}
            </small>
          </li>
        ))}
      </ul>
    </>
  );
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; sucursal?: string }>;
}) {
  const params = await searchParams;
  const periodo = leerPeriodo(params.periodo);
  const sucursal = leerSucursal(params.sucursal);
  const { desde, hasta } = rangoDe(periodo);

  const resultado = await getReportes({
    ...(sucursal ? { branchId: sucursal } : {}),
    desde,
    hasta,
  });
  // El action arma categorías/estilos con clave calculada (`{[nombre]: valor}`),
  // así que su tipo inferido es un índice y no la forma que consume la página.
  const reportes = resultado.success ? (resultado.data as unknown as Reportes) : null;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <BrandBand
        header={
          <PageHeader
            title="Clientas y reportes"
            right={<FiltrosReporte periodo={periodo} sucursal={sucursal} />}
          />
        }
      />

      <main className="glass -mt-12 flex flex-col gap-3 rounded-t-[2.5rem] px-4 pt-6 pb-8 md:gap-5 md:px-8 md:pt-8">
        <p className="-mt-1 text-sm text-ink-muted">Solo la dueña ve costos y ganancias</p>

        {!reportes ? (
          <p className="text-sm text-ink-muted">
            No se pudieron cargar los reportes. Probá de nuevo.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
              <Kpi
                label="Ingresos"
                valor={plata(reportes.kpis.ingresos)}
                detalle={plural(reportes.kpis.ventas, "venta", "ventas")}
              />
              <Kpi
                label="Costo de mercadería"
                valor={plata(reportes.kpis.costo)}
                detalle="lo que pagaste"
                nota={
                  reportes.kpis.itemsSinCosto > 0
                    ? plural(reportes.kpis.itemsSinCosto, "ítem sin costo cargado", "ítems sin costo cargado")
                    : undefined
                }
              />
              <Kpi
                label="Ganancia"
                valor={plata(reportes.kpis.ganancia)}
                detalle={`margen ${Math.round(reportes.kpis.margen)} %`}
                rojo
              />
              <Kpi
                label="Ticket promedio"
                valor={plata(reportes.kpis.ticketPromedio)}
                detalle="por venta"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-5">
              <Panel title="Ventas por semana">
                <Semanas semanas={reportes.semanas} />
              </Panel>
              <Panel title="Por categoría">
                {reportes.categorias.length === 0 ? (
                  <Vacio>Sin ventas por categoría.</Vacio>
                ) : (
                  <Barras
                    filas={reportes.categorias.map((fila) => ({
                      label: fila.categoria,
                      total: fila.total,
                    }))}
                  />
                )}
              </Panel>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:gap-5">
              <Panel title="Ventas por estilo">
                {reportes.estilos.length === 0 ? (
                  <Vacio>Sin ventas por estilo.</Vacio>
                ) : (
                  <Barras
                    filas={reportes.estilos.map((fila) => ({
                      label: fila.estilo,
                      total: fila.total,
                    }))}
                  />
                )}
              </Panel>
              {/* Si el action algún día deja de devolver el stock, la tarjeta se va sin romper. */}
              {reportes.stockPorEstilo && (
                <Panel title="Stock por estilo">
                  {reportes.stockPorEstilo.length === 0 ? (
                    <Vacio>No hay stock por estilo.</Vacio>
                  ) : (
                    <Barras
                      formato={unidades}
                      filas={reportes.stockPorEstilo.map((fila) => ({
                        label: fila.estilo,
                        total: fila.stock,
                      }))}
                    />
                  )}
                </Panel>
              )}
            </div>

            <Panel title="Clientas que más compran">
              <Clientas clientas={reportes.topClientas} />
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
