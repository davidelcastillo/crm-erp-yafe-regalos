"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { ValueChange } from "@/components/ui/ValueChange";
import { toLocalDateKey, toShortLabel } from "@/lib/dates";

/**
 * Las secciones de `panel.html` que se alimentan de `getResumenPanel`: los cuatro
 * KPIs, ventas por canal, reservas por cobrar, últimas ventas, para enviar y el
 * top de estilos del período.
 *
 * El número se escribe acá y no con `style: "currency"`: el formateador de moneda
 * de `es-AR` pega un espacio duro que rompe los rótulos y los tests.
 */
const plata = (monto: number) =>
  `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(monto)}`;

export type ResumenPanelData = {
  ventas: { monto: number; unidades: number; cantidad: number };
  prendasDisponibles: number;
  reservas: { cantidad: number; saldo: number; vencenHoy: number };
  paraEnviar: { cantidad: number; salenHoy: number };
  porCanal: { canal: string; monto: number; porcentaje: number }[];
  estilos: { estilo: string; total: number; unidades: number }[];
  reservasPorCobrar: {
    id: number;
    numero: string;
    cliente: string;
    prenda: string;
    venceEl: string | null;
    saldo: number;
  }[];
  ultimasVentas: {
    id: number;
    fecha: string;
    cliente: string;
    prenda: string;
    canal: string;
    monto: number;
  }[];
  paraEnviarLista: {
    id: number;
    numero: string;
    cliente: string;
    prenda: string;
    envioEstado: string | null;
  }[];
};

/** La tarjeta del mockup: superficie, borde hairline, radio 18 y 20 de aire. */
const Panel = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) => (
  <section className="min-w-0 rounded-[18px] border border-hairline bg-surface p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {action && (
        <Link href={action.href} className="shrink-0 text-sm font-semibold text-accent">
          {action.label}
        </Link>
      )}
    </div>
    {children}
  </section>
);

const Vacio = ({ children }: { children: ReactNode }) => (
  <p className="py-2 text-sm text-ink-muted">{children}</p>
);

/** Fila de lista: título, detalle y lo que va a la derecha (chip, monto, estado). */
const Fila = ({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: string;
  children?: ReactNode;
}) => (
  <li className="flex items-center gap-3 border-t border-hairline py-3 first:border-t-0 first:pt-0">
    <div className="min-w-0 flex-1">
      <strong className="block text-[15px] font-semibold text-ink break-words">{titulo}</strong>
      <small className="block text-[13px] text-ink-muted break-words">{detalle}</small>
    </div>
    {children}
  </li>
);

/** Pista fina con relleno cacao, el mismo trazo en las dos tarjetas de barras. */
const Barra = ({
  label,
  valor,
  porcentaje,
}: {
  label: string;
  valor: string;
  porcentaje: number;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between gap-2 text-sm text-ink">
      <span className="min-w-0 break-words">{label}</span>
      <b className="shrink-0">{valor}</b>
    </div>
    <div className="h-3 rounded-full bg-surface-strong" aria-hidden="true">
      <i
        className="block h-full rounded-full bg-ink"
        style={{ width: `${Math.min(100, Math.max(2, porcentaje))}%` }}
      />
    </div>
  </div>
);

const Kpi = ({
  label,
  valor,
  detalle,
  rojo = false,
}: {
  label: string;
  valor: string;
  detalle: string;
  rojo?: boolean;
}) => (
  <div className="min-w-0 rounded-[18px] border border-hairline bg-surface p-4">
    <span className="block text-[13px] text-ink-muted">{label}</span>
    <ValueChange
      key={valor}
      className={`block py-1.5 text-2xl font-semibold sm:text-3xl ${rojo ? "text-accent" : "text-ink"}`}
    >
      {valor}
    </ValueChange>
    <small className="block text-xs text-ink-muted">{detalle}</small>
  </div>
);

const ESTADO_ENVIO: Record<string, { label: string; clase: string }> = {
  ETIQUETA_LISTA: { label: "Etiqueta lista", clase: "bg-positive/10 text-positive" },
  FALTA_EMBALAR: { label: "Falta embalar", clase: "bg-warning/10 text-warning-strong" },
  COORDINAR: { label: "Coordinar", clase: "bg-surface-strong text-ink-muted" },
};

/** «vence hoy» / «vence mañana» / «vence el 21/11», en días locales. */
const vencimiento = (clave: string | null) => {
  if (!clave) return "sin vencimiento";
  const hoy = toLocalDateKey(new Date());
  if (clave === hoy) return "vence hoy";
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  if (clave === toLocalDateKey(manana)) return "vence mañana";
  return `vence el ${toShortLabel(clave)}`;
};

const plural = (cantidad: number, uno: string, varios: string) =>
  `${cantidad} ${cantidad === 1 ? uno : varios}`;

export function ResumenPanel({ data }: { data: ResumenPanelData | null }) {
  const resumen: ResumenPanelData = data ?? {
    ventas: { monto: 0, unidades: 0, cantidad: 0 },
    prendasDisponibles: 0,
    reservas: { cantidad: 0, saldo: 0, vencenHoy: 0 },
    paraEnviar: { cantidad: 0, salenHoy: 0 },
    porCanal: [],
    estilos: [],
    reservasPorCobrar: [],
    ultimasVentas: [],
    paraEnviarLista: [],
  };

  const kpis = [
    {
      label: "Ventas del período",
      valor: plata(resumen.ventas.monto),
      detalle: plural(resumen.ventas.cantidad, "venta", "ventas"),
    },
    {
      label: "Prendas disponibles",
      valor: String(resumen.prendasDisponibles),
      detalle: "en inventario",
    },
    {
      label: "Reservas sin cobrar",
      valor: String(resumen.reservas.cantidad),
      detalle:
        resumen.reservas.vencenHoy === 0
          ? "Ninguna vence hoy"
          : plural(resumen.reservas.vencenHoy, "vence hoy", "vencen hoy"),
      rojo: true,
    },
    {
      label: "Pedidos para enviar",
      valor: String(resumen.paraEnviar.cantidad),
      detalle: plural(resumen.paraEnviar.salenHoy, "sale hoy", "salen hoy"),
      rojo: true,
    },
  ];

  const topEstilo = resumen.estilos[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-5">
        {kpis.map((kpi, index) => (
          <Reveal key={kpi.label} index={index}>
            <Kpi {...kpi} />
          </Reveal>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        <Panel title="Ventas por canal" action={{ href: "/reportes", label: "Ver reporte" }}>
          {resumen.porCanal.length === 0 ? (
            <Vacio>Sin ventas en el período.</Vacio>
          ) : (
            <div className="flex flex-col gap-3.5">
              {resumen.porCanal.map((canal) => (
                <Barra
                  key={canal.canal}
                  label={canal.canal}
                  valor={`${Math.round(canal.porcentaje)}%`}
                  porcentaje={canal.porcentaje}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Reservas por cobrar" action={{ href: "/ventas/pedidos", label: "Ver todas" }}>
          {resumen.reservasPorCobrar.length === 0 ? (
            <Vacio>No hay reservas sin cobrar.</Vacio>
          ) : (
            <ul>
              {resumen.reservasPorCobrar.map((reserva) => (
                <Fila
                  key={reserva.id}
                  titulo={reserva.cliente}
                  detalle={`${reserva.prenda} · ${vencimiento(reserva.venceEl)}`}
                >
                  <b className="shrink-0 text-sm text-ink">{plata(reserva.saldo)}</b>
                </Fila>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        <Panel title="Últimas ventas" action={{ href: "/ventas", label: "Ver ventas" }}>
          {resumen.ultimasVentas.length === 0 ? (
            <Vacio>Todavía no hay ventas.</Vacio>
          ) : (
            <ul>
              {resumen.ultimasVentas.map((venta) => (
                <Fila key={venta.id} titulo={venta.cliente} detalle={venta.prenda}>
                  <span className="shrink-0 rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold text-ink-muted">
                    {venta.canal}
                  </span>
                  <b className="shrink-0 text-sm text-ink">{plata(venta.monto)}</b>
                </Fila>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Para enviar" action={{ href: "/ventas/pedidos", label: "Ver pedidos" }}>
          {resumen.paraEnviarLista.length === 0 ? (
            <Vacio>No hay pedidos para enviar.</Vacio>
          ) : (
            <ul>
              {resumen.paraEnviarLista.map((pedido) => {
                const estado =
                  ESTADO_ENVIO[pedido.envioEstado ?? "COORDINAR"] ?? ESTADO_ENVIO.COORDINAR;
                return (
                  <Fila key={pedido.id} titulo={pedido.cliente} detalle={pedido.prenda}>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${estado.clase}`}
                    >
                      {estado.label}
                    </span>
                  </Fila>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Estilos más vendidos" action={{ href: "/reportes", label: "Ver reporte" }}>
        {resumen.estilos.length === 0 ? (
          <Vacio>Todavía no hay estilos vendidos.</Vacio>
        ) : (
          <div className="flex flex-col gap-3.5">
            {resumen.estilos.map((estilo) => (
              <Barra
                key={estilo.estilo}
                label={estilo.estilo}
                valor={plata(estilo.total)}
                porcentaje={topEstilo > 0 ? (estilo.total / topEstilo) * 100 : 0}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
