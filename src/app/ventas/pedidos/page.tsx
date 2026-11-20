"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { useReloadKey } from "@/lib/hooks/useReloadKey";
import { useBranch } from "@/lib/context/BranchContext";
import { inicioDelDia, toLocalDateKey } from "@/lib/dates";
import {
  actualizarEnvio,
  cancelarPedido,
  getContadoresPedidos,
  getPedidosPorEstado,
  moverPedido,
  registrarSena,
} from "@/app/actions/pedido";
import { getCanalVentaOptions } from "@/app/actions/prendaTaxonomy";
import { getProducts } from "@/app/actions/product";
import { PedidoForm, type PedidoProducto } from "./components/PedidoForm";
import { CobrarPedidoModal } from "./components/CobrarPedidoModal";

/**
 * Pedidos (U5, S3): el tablero dentro de /ventas. Cuatro columnas en PC con
 * arrastre y una lista con selector por estado en el celular.
 *
 * Reglas del tablero: a «Pagado» no se entra arrastrando (soltar ahí abre el
 * paso de cobro), la reserva y la plata las calcula el servidor y esta pantalla
 * no muestra ni manda costo.
 */

type Estado = "RESERVADO" | "PAGADO" | "PARA_ENVIAR" | "ENTREGADO";
type MetodoEnvio = "CORREO" | "ENCOMIENDA" | "RETIRO";
type EstadoEnvio = "COORDINAR" | "FALTA_EMBALAR" | "ETIQUETA_LISTA";

type PedidoTarjeta = {
  id: number;
  numero: string;
  canal: string;
  cliente: string;
  ciudad: string | null;
  items: Array<{ nombre: string; cantidad: number }>;
  itemsRestantes: number;
  senas: number;
  saldo: number;
  total: number;
  medio: string | null;
  envioMetodo: string | null;
  envioEstado: string | null;
  venceEl: string | null;
};

const COLUMNAS: Array<{ id: Estado; label: string }> = [
  { id: "RESERVADO", label: "Reservado" },
  { id: "PAGADO", label: "Pagado" },
  { id: "PARA_ENVIAR", label: "Para enviar" },
  { id: "ENTREGADO", label: "Entregado" },
];

/** Las transiciones que no tocan plata; a Pagado se entra cobrando (S3). */
const TRANSICIONES: Record<Estado, Estado[]> = {
  RESERVADO: [],
  PAGADO: ["PARA_ENVIAR"],
  PARA_ENVIAR: ["ENTREGADO", "PAGADO"],
  ENTREGADO: ["PARA_ENVIAR"],
};

const TINTE: Record<Estado, string> = {
  RESERVADO: "bg-brand-rosa/10",
  PAGADO: "bg-positive/10",
  PARA_ENVIAR: "bg-accent/10",
  ENTREGADO: "bg-surface-strong",
};

const ETIQUETA_METODO: Record<string, string> = {
  CORREO: "Correo",
  ENCOMIENDA: "Encomienda",
  RETIRO: "Retiro",
};

const ETIQUETA_ENVIO: Record<string, string> = {
  COORDINAR: "Coordinar",
  FALTA_EMBALAR: "Falta embalar",
  ETIQUETA_LISTA: "Etiqueta lista",
};

const ETIQUETA_MEDIO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MIXTO: "Mixto",
};

/** Cuántas tarjetas trae cada columna antes del «Ver más». */
const TOMA = 10;

const plata = (monto: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(monto);

/** Días de calendario hasta el vencimiento: 0 = hoy, negativo = vencida. */
const diasParaVencer = (iso: string) => {
  const hoy = inicioDelDia(toLocalDateKey(new Date())).getTime();
  const vence = inicioDelDia(toLocalDateKey(new Date(iso))).getTime();
  return Math.round((vence - hoy) / (24 * 60 * 60 * 1000));
};

const campo =
  "mt-1 w-full min-h-[44px] rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none touch-manipulation";

const botonChico = "btn btn-secondary min-h-[44px] flex-1 px-3 text-sm";

interface PedidoCardProps {
  pedido: PedidoTarjeta;
  estado: Estado;
  onDragStart: () => void;
  onCobrar: () => void;
  onMover: (hacia: Estado) => void;
  onCambio: () => void;
}

/**
 * La tarjeta del pedido. Es la misma en las dos vistas: en PC se arrastra, en el
 * celular se mueve con los botones de abajo. Todo lo que entra a una fila de
 * `flex` va con `min-w-0` y `truncate` (lección M1/M6: los nombres largos
 * rompían la tarjeta).
 */
const PedidoCard = ({ pedido, estado, onDragStart, onCobrar, onMover, onCambio }: PedidoCardProps) => {
  const [panel, setPanel] = useState<"sena" | "envio" | "mover" | null>(null);
  const [montoSena, setMontoSena] = useState("");
  const [medioSena, setMedioSena] = useState("EFECTIVO");
  const [envioMetodo, setEnvioMetodo] = useState<MetodoEnvio>(
    (pedido.envioMetodo as MetodoEnvio) ?? "CORREO"
  );
  const [envioEstado, setEnvioEstado] = useState<EstadoEnvio>(
    (pedido.envioEstado as EstadoEnvio) ?? "COORDINAR"
  );
  const [ciudad, setCiudad] = useState(pedido.ciudad ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dias = pedido.venceEl ? diasParaVencer(pedido.venceEl) : null;
  const avisoVencimiento =
    dias === null
      ? null
      : dias < 0
        ? "vencida"
        : dias === 0
          ? "vence hoy"
          : dias === 1
            ? "vence mañana"
            : null;
  const resumen =
    estado === "RESERVADO"
      ? pedido.senas > 0
        ? `Seña ${plata(pedido.senas)} · Saldo ${plata(pedido.saldo)}`
        : "Sin seña"
      : pedido.medio
        ? ETIQUETA_MEDIO[pedido.medio] ?? pedido.medio
        : "";

  const alternar = (nuevo: "sena" | "envio" | "mover") => {
    setError(null);
    setPanel((actual) => (actual === nuevo ? null : nuevo));
  };

  const guardarSena = async () => {
    const monto = Number(montoSena);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto tiene que ser mayor a 0");
      return;
    }
    setPending(true);
    const result = await registrarSena({ id: pedido.id, monto, metodo: medioSena });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Error al registrar la seña");
      return;
    }
    setMontoSena("");
    setPanel(null);
    onCambio();
  };

  const guardarEnvio = async () => {
    setPending(true);
    const result = await actualizarEnvio({
      id: pedido.id,
      envioMetodo,
      envioEstado,
      ciudad: ciudad.trim() || undefined,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Error al actualizar el envío");
      return;
    }
    setPanel(null);
    onCambio();
  };

  const cancelar = async () => {
    const modal = await Swal.fire({
      title: "¿Cancelar el pedido?",
      input: "textarea",
      inputLabel: "Motivo (y qué pasa con la seña)",
      inputPlaceholder: "Ej.: no confirmó; se devolvió la seña en efectivo",
      showCancelButton: true,
      confirmButtonText: "Cancelar pedido",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6a6a6a",
      inputValidator: (value) =>
        !value || !value.trim() ? "El motivo es obligatorio" : null,
    });
    if (!modal.isConfirmed) return;

    const result = await cancelarPedido({ id: pedido.id, motivo: modal.value.trim() });
    if (!result.success) {
      await Swal.fire({
        title: "No se pudo cancelar",
        text: result.error ?? "Error al cancelar el pedido",
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
      return;
    }
    onCambio();
  };

  return (
    <article
      draggable
      onDragStart={onDragStart}
      aria-label={`Pedido ${pedido.numero}`}
      className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="min-w-0 truncate">{pedido.numero}</span>
        <span className="min-w-0 truncate rounded-full bg-surface-strong px-2 py-0.5 text-ink-body">
          {pedido.canal}
        </span>
      </div>

      <p className="min-w-0 truncate text-base font-semibold text-ink">{pedido.cliente}</p>
      {pedido.ciudad && (
        <p className="min-w-0 truncate text-xs text-ink-muted">{pedido.ciudad}</p>
      )}

      <ul className="space-y-0.5 text-sm text-ink-body">
        {pedido.items.map((item) => (
          <li key={item.nombre} className="min-w-0 truncate">
            {item.nombre} ×{item.cantidad}
          </li>
        ))}
        {pedido.itemsRestantes > 0 && (
          <li className="text-xs text-ink-muted">+{pedido.itemsRestantes} más</li>
        )}
      </ul>

      {pedido.envioMetodo && (
        <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-ink-muted">
          <span className="min-w-0 truncate">
            {ETIQUETA_METODO[pedido.envioMetodo] ?? pedido.envioMetodo}
          </span>
          {pedido.envioEstado && (
            <span className="rounded bg-info/10 px-1.5 py-0.5 text-info">
              {ETIQUETA_ENVIO[pedido.envioEstado] ?? pedido.envioEstado}
            </span>
          )}
        </p>
      )}

      {avisoVencimiento && (
        <p className="w-fit rounded-lg bg-warning-strong/15 px-2 py-1 text-xs font-medium text-warning">
          {avisoVencimiento}
        </p>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-ink-muted">{resumen}</span>
        <b className="tabular-nums text-sm text-ink">{plata(pedido.total)}</b>
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        {estado === "RESERVADO" && (
          <>
            <button
              type="button"
              onClick={() => alternar("sena")}
              aria-expanded={panel === "sena"}
              className={botonChico}
            >
              + Seña
            </button>
            <button type="button" onClick={onCobrar} className="btn btn-primary min-h-[44px] flex-1 px-3 text-sm">
              Cobrar
            </button>
            <button type="button" onClick={cancelar} className={botonChico}>
              Cancelar
            </button>
          </>
        )}

        {(estado === "PAGADO" || estado === "PARA_ENVIAR") && (
          <button
            type="button"
            onClick={() => alternar("envio")}
            aria-expanded={panel === "envio"}
            className={botonChico}
          >
            Envío
          </button>
        )}

        {TRANSICIONES[estado].length > 0 && (
          <button
            type="button"
            onClick={() => alternar("mover")}
            aria-expanded={panel === "mover"}
            className={`${botonChico} md:hidden`}
          >
            Mover
          </button>
        )}
      </div>

      {panel === "sena" && (
        <div className="rounded-xl border border-hairline bg-surface-soft p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-ink" htmlFor={`sena-monto-${pedido.id}`}>
              Monto
              <input
                id={`sena-monto-${pedido.id}`}
                type="number"
                min={0}
                inputMode="decimal"
                value={montoSena}
                onChange={(event) => setMontoSena(event.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-xs font-semibold text-ink" htmlFor={`sena-medio-${pedido.id}`}>
              Medio
              <select
                id={`sena-medio-${pedido.id}`}
                value={medioSena}
                onChange={(event) => setMedioSena(event.target.value)}
                className={campo}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={guardarSena}
            disabled={pending}
            className="btn btn-primary mt-2 w-full"
          >
            Registrar seña
          </button>
        </div>
      )}

      {panel === "envio" && (
        <div className="rounded-xl border border-hairline bg-surface-soft p-3">
          <label className="block text-xs font-semibold text-ink" htmlFor={`envio-metodo-${pedido.id}`}>
            Método
            <select
              id={`envio-metodo-${pedido.id}`}
              value={envioMetodo}
              onChange={(event) => setEnvioMetodo(event.target.value as MetodoEnvio)}
              className={campo}
            >
              <option value="CORREO">Correo</option>
              <option value="ENCOMIENDA">Encomienda</option>
              <option value="RETIRO">Retiro</option>
            </select>
          </label>
          <label className="mt-2 block text-xs font-semibold text-ink" htmlFor={`envio-estado-${pedido.id}`}>
            Preparación
            <select
              id={`envio-estado-${pedido.id}`}
              value={envioEstado}
              onChange={(event) => setEnvioEstado(event.target.value as EstadoEnvio)}
              className={campo}
            >
              <option value="COORDINAR">Coordinar</option>
              <option value="FALTA_EMBALAR">Falta embalar</option>
              <option value="ETIQUETA_LISTA">Etiqueta lista</option>
            </select>
          </label>
          <label className="mt-2 block text-xs font-semibold text-ink" htmlFor={`envio-ciudad-${pedido.id}`}>
            Ciudad
            <input
              id={`envio-ciudad-${pedido.id}`}
              value={ciudad}
              onChange={(event) => setCiudad(event.target.value)}
              className={campo}
            />
          </label>
          <button
            type="button"
            onClick={guardarEnvio}
            disabled={pending}
            className="btn btn-primary mt-2 w-full"
          >
            Guardar envío
          </button>
        </div>
      )}

      {panel === "mover" && (
        <div role="group" aria-label="Mover pedido" className="flex flex-wrap gap-2">
          {TRANSICIONES[estado].map((hacia) => (
            <button
              key={hacia}
              type="button"
              onClick={() => {
                setPanel(null);
                onMover(hacia);
              }}
              className={botonChico}
            >
              Mover a {COLUMNAS.find((columna) => columna.id === hacia)?.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-error-surface px-2 py-1 text-xs text-error-ink">
          {error}
        </p>
      )}
    </article>
  );
};

export default function PedidosPage() {
  const [reloadKey, bump] = useReloadKey();
  const { branchId } = useBranch();
  const [contadores, setContadores] = useState<Record<Estado, number>>({
    RESERVADO: 0,
    PAGADO: 0,
    PARA_ENVIAR: 0,
    ENTREGADO: 0,
  });
  const [columnas, setColumnas] = useState<Record<Estado, PedidoTarjeta[]>>({
    RESERVADO: [],
    PAGADO: [],
    PARA_ENVIAR: [],
    ENTREGADO: [],
  });
  const [hayMas, setHayMas] = useState<Record<Estado, boolean>>({
    RESERVADO: false,
    PAGADO: false,
    PARA_ENVIAR: false,
    ENTREGADO: false,
  });
  const [canales, setCanales] = useState<Array<{ id: number; name: string }>>([]);
  const [canal, setCanal] = useState("");
  const [productos, setProductos] = useState<PedidoProducto[]>([]);
  const [tab, setTab] = useState<Estado>("RESERVADO");
  const [formOpen, setFormOpen] = useState(false);
  const [cobroId, setCobroId] = useState<number | null>(null);
  const [envioPendiente, setEnvioPendiente] = useState<{
    id: number;
    desde: Estado;
    hacia: Estado;
    metodo: MetodoEnvio;
    ciudad: string;
  } | null>(null);
  // La tarjeta que se está arrastrando: el arrastre nativo no necesita
  // `dataTransfer` para nada más.
  const arrastrada = useRef<{ pedido: PedidoTarjeta; estado: Estado } | null>(null);

  // Una consulta por columna y los conteos del tablero (ADR §4). El setState va
  // diferido: un effect no escribe estado sincrónicamente.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const canalId = canal ? Number(canal) : undefined;
        const [contadoresRes, ...columnasRes] = await Promise.all([
          getContadoresPedidos(canalId),
          ...COLUMNAS.map((columna) =>
            getPedidosPorEstado({ estado: columna.id, canalId, take: TOMA })
          ),
        ]);
        if (cancelled) return;

        if (contadoresRes.success && contadoresRes.data) {
          const data = contadoresRes.data as Record<string, number>;
          setContadores({
            RESERVADO: data.RESERVADO ?? 0,
            PAGADO: data.PAGADO ?? 0,
            PARA_ENVIAR: data.PARA_ENVIAR ?? 0,
            ENTREGADO: data.ENTREGADO ?? 0,
          });
        }

        const nuevas = { ...columnas };
        const mas = { ...hayMas };
        COLUMNAS.forEach((columna, indice) => {
          const resultado = columnasRes[indice];
          const filas =
            resultado.success && resultado.data
              ? (resultado.data as unknown as PedidoTarjeta[])
              : [];
          nuevas[columna.id] = filas;
          mas[columna.id] = filas.length === TOMA;
        });
        setColumnas(nuevas);
        setHayMas(mas);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `columnas`/`hayMas` se leen de su versión inicial: solo se acumulan acá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, reloadKey]);

  // Filtro de canal y catálogo del alta: no dependen del tablero.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const [canalesRes, productosRes] = await Promise.all([
          getCanalVentaOptions(),
          getProducts(branchId ?? undefined),
        ]);
        if (cancelled) return;
        if (canalesRes.success && canalesRes.data) setCanales(canalesRes.data);
        if (productosRes.success && productosRes.data) {
          setProductos(
            (productosRes.data as unknown as Array<{
              id: number;
              name: string;
              code: string;
              price: number | string;
              inventory?: Array<{ stock: number }>;
            }>).map((producto) => ({
              id: producto.id,
              name: producto.name,
              code: producto.code,
              price: producto.price,
              stock: producto.inventory?.reduce((suma, fila) => suma + fila.stock, 0) ?? 0,
            }))
          );
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [branchId]);

  const verMas = async (estado: Estado) => {
    const actuales = columnas[estado];
    const cursor = actuales[actuales.length - 1]?.id;
    const resultado = await getPedidosPorEstado({
      estado,
      canalId: canal ? Number(canal) : undefined,
      take: TOMA,
      ...(cursor ? { cursor } : {}),
    });
    if (!resultado.success || !resultado.data) return;
    const filas = resultado.data as unknown as PedidoTarjeta[];
    setColumnas((previas) => ({ ...previas, [estado]: [...previas[estado], ...filas] }));
    setHayMas((previas) => ({ ...previas, [estado]: filas.length === TOMA }));
  };

  /**
   * Mueve la tarjeta. Si el servidor pide el envío (método o ciudad), se abre el
   * formulario chico y se reintenta la misma transición.
   */
  const mover = useCallback(
    async (
      pedido: { id: number; envioMetodo?: string | null; ciudad?: string | null },
      desde: Estado,
      hacia: Estado,
      envio?: { metodo?: MetodoEnvio; ciudad?: string }
    ) => {
      const resultado = await moverPedido({
        id: pedido.id,
        desde,
        hacia,
        ...(envio?.metodo ? { envioMetodo: envio.metodo } : {}),
        ...(envio?.ciudad ? { ciudad: envio.ciudad } : {}),
      });

      if (resultado.success) {
        bump();
        return;
      }

      const mensaje = resultado.error ?? "Error al mover el pedido";
      if (/método de envío|ciudad es obligatoria/i.test(mensaje)) {
        setEnvioPendiente({
          id: pedido.id,
          desde,
          hacia,
          metodo: (pedido.envioMetodo as MetodoEnvio) ?? "CORREO",
          ciudad: pedido.ciudad ?? "",
        });
        return;
      }
      if (/cambió de estado/i.test(mensaje)) bump();

      await Swal.fire({
        title: "No se pudo mover",
        text: mensaje,
        icon: "warning",
        confirmButtonColor: "#6d28d9",
      });
    },
    [bump]
  );

  const soltarEn = (hacia: Estado) => {
    const origen = arrastrada.current;
    arrastrada.current = null;
    if (!origen) return;

    // A Pagado se entra cobrando: soltar acá abre el paso de cobro.
    if (hacia === "PAGADO" && origen.estado === "RESERVADO") {
      setCobroId(origen.pedido.id);
      return;
    }
    if (!TRANSICIONES[origen.estado].includes(hacia)) {
      void Swal.fire({
        title: "Transición no permitida",
        text: `No se puede pasar de ${COLUMNAS.find(
          (columna) => columna.id === origen.estado
        )?.label} a ${COLUMNAS.find((columna) => columna.id === hacia)?.label}.`,
        icon: "info",
        confirmButtonColor: "#6d28d9",
      });
      return;
    }
    void mover(origen.pedido, origen.estado, hacia);
  };

  const opcionesCanal = [
    { value: "", label: "Todos" },
    ...canales.map((item) => ({ value: String(item.id), label: item.name })),
  ];

  return (
    <div className="min-h-screen bg-surface pb-20">
      <PageHeader
        title="Pedidos"
        actions={
          <button type="button" onClick={() => setFormOpen(true)} className="btn btn-primary">
            Nuevo pedido
          </button>
        }
      />

      <main className="px-3 pt-4">
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="btn btn-primary w-full"
          >
            Nuevo pedido
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterSelect label="Canal" value={canal} options={opcionesCanal} onChange={setCanal} />
        </div>

        {/* Celular: un selector por estado y una sola columna a la vista. */}
        <div
          role="tablist"
          aria-label="Estado del pedido"
          className="mt-3 flex gap-1 rounded-xl bg-surface-strong p-1 md:hidden"
        >
          {COLUMNAS.map((columna) => (
            <button
              key={columna.id}
              type="button"
              role="tab"
              aria-selected={tab === columna.id}
              onClick={() => setTab(columna.id)}
              className={`min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors touch-manipulation ${
                tab === columna.id ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
              }`}
            >
              {columna.label} ({contadores[columna.id]})
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 items-start gap-4 md:grid-cols-4">
          {COLUMNAS.map((columna) => (
            <section
              key={columna.id}
              id={`columna-${columna.id}`}
              role="region"
              aria-label={columna.label}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                soltarEn(columna.id);
              }}
              className={`${
                tab === columna.id ? "flex" : "hidden"
              } min-w-0 flex-col gap-3 rounded-2xl p-3 md:flex ${TINTE[columna.id]}`}
            >
              <h2 className="flex items-baseline justify-between gap-2 px-1 text-sm font-semibold text-ink">
                <span className="min-w-0 truncate">{columna.label}</span>
                <span className="tabular-nums text-ink-muted">{contadores[columna.id]}</span>
              </h2>

              {columnas[columna.id].length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">Sin pedidos</p>
              ) : (
                columnas[columna.id].map((pedido) => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    estado={columna.id}
                    onDragStart={() => {
                      arrastrada.current = { pedido, estado: columna.id };
                    }}
                    onCobrar={() => setCobroId(pedido.id)}
                    onMover={(hacia) => void mover(pedido, columna.id, hacia)}
                    onCambio={bump}
                  />
                ))
              )}

              {hayMas[columna.id] && (
                <button
                  type="button"
                  onClick={() => void verMas(columna.id)}
                  className="btn btn-ghost min-h-[44px] w-full"
                >
                  Ver más
                </button>
              )}
            </section>
          ))}
        </div>
      </main>

      <PedidoForm
        open={formOpen}
        products={productos}
        onClose={() => setFormOpen(false)}
        onCreated={bump}
      />

      <CobrarPedidoModal
        open={cobroId !== null}
        pedidoId={cobroId}
        onClose={() => setCobroId(null)}
        onCobrado={bump}
      />

      {envioPendiente && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim backdrop-blur-md md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="envio-pendiente-title"
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-surface p-6 animate-slide-up md:rounded-2xl md:animate-scale-in">
            <h2 id="envio-pendiente-title" className="text-xl font-semibold text-ink">
              Datos del envío
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Para pasar el pedido a «Para enviar» falta el método y la ciudad.
            </p>

            <label className="mt-3 block text-sm font-semibold text-ink" htmlFor="pendiente-metodo">
              Método de envío
              <select
                id="pendiente-metodo"
                value={envioPendiente.metodo}
                onChange={(event) =>
                  setEnvioPendiente({
                    ...envioPendiente,
                    metodo: event.target.value as MetodoEnvio,
                  })
                }
                className={campo}
              >
                <option value="CORREO">Correo</option>
                <option value="ENCOMIENDA">Encomienda</option>
                <option value="RETIRO">Retiro</option>
              </select>
            </label>

            <label className="mt-3 block text-sm font-semibold text-ink" htmlFor="pendiente-ciudad">
              Ciudad
              <input
                id="pendiente-ciudad"
                value={envioPendiente.ciudad}
                onChange={(event) =>
                  setEnvioPendiente({ ...envioPendiente, ciudad: event.target.value })
                }
                className={campo}
              />
            </label>

            <div className="mt-4 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setEnvioPendiente(null)}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const pendiente = envioPendiente;
                  setEnvioPendiente(null);
                  void mover(
                    { id: pendiente.id },
                    pendiente.desde,
                    pendiente.hacia,
                    { metodo: pendiente.metodo, ciudad: pendiente.ciudad.trim() || undefined }
                  );
                }}
                className="btn btn-primary"
              >
                Mover pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
