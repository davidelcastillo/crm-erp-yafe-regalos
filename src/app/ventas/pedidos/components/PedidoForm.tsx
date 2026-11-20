"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductSearch, type ProductSearchResult } from "@/components/ProductSearch";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { useBranch } from "@/lib/context/BranchContext";
import { createPedido } from "@/app/actions/pedido";
import { createCustomer, getCustomers } from "@/app/actions/customer";
import { getCanalVentaOptions } from "@/app/actions/prendaTaxonomy";

/**
 * Alta de un pedido (U5, S2): clienta de origen, canal, productos con cantidad,
 * una sola sucursal, seña opcional y vencimiento opcional.
 *
 * El precio no se elige acá: el servidor lo toma de la base al crear (I7) y
 * devuelve el total. El total de abajo es solo la vista previa del formulario.
 */
export interface PedidoProducto {
  id: number;
  name: string;
  code: string;
  price: number | string;
  /** Unidades en la sucursal del encabezado; solo informa. */
  stock?: number;
}

export interface PedidoFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  products: PedidoProducto[];
}

type ClienteOption = { id: number; name: string; surname: string };
type CanalOption = { id: number; name: string };
type Linea = {
  productId: number;
  nombre: string;
  code: string;
  precio: number;
  cantidad: string;
};

const MEDIOS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

const plata = (monto: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(monto);

const ETIQUETA_CLIENTE = (cliente: ClienteOption) =>
  `${cliente.name} ${cliente.surname}`.trim();

const campo =
  "mt-1 w-full min-h-[44px] rounded-xl border border-hairline bg-surface px-3 py-3 text-base text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all touch-manipulation";

export const PedidoForm = ({ open, onClose, onCreated, products }: PedidoFormProps) => {
  const { branchId, branches } = useBranch();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [canales, setCanales] = useState<CanalOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [canalId, setCanalId] = useState("");
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [senaMonto, setSenaMonto] = useState("");
  const [senaMedio, setSenaMedio] = useState("EFECTIVO");
  const [venceEl, setVenceEl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Alta de clienta sin salir del pedido (evita cargarla antes en otro lado).
  const [nuevaClienta, setNuevaClienta] = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const [apellidoNueva, setApellidoNueva] = useState("");
  const [telefonoNueva, setTelefonoNueva] = useState("");

  // Los datos fijos del alta se piden al abrir. El setState va diferido: un
  // effect no puede escribir estado sincrónicamente (misma lección que
  // CashMovementsModal).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const [clientesRes, canalesRes] = await Promise.all([
          getCustomers(),
          getCanalVentaOptions(),
        ]);
        if (cancelled) return;
        setClientes(
          clientesRes.success && clientesRes.data
            ? (clientesRes.data as unknown as ClienteOption[])
            : []
        );
        setCanales(canalesRes.success && canalesRes.data ? canalesRes.data : []);
        setSucursalId(branchId ?? null);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, branchId]);

  const catalogo: ProductSearchResult[] = useMemo(
    () =>
      products.map((producto) => ({
        id: producto.id,
        code: producto.code,
        name: producto.name,
        price: Number(producto.price),
        stock: producto.stock ?? 0,
      })),
    [products]
  );

  const total = lineas.reduce(
    (suma, linea) => suma + linea.precio * (parseInt(linea.cantidad, 10) || 0),
    0
  );

  const agregarProducto = (producto: ProductSearchResult) => {
    setError(null);
    // El servidor no acepta el mismo producto en dos líneas: se suma la cantidad.
    setLineas((previas) =>
      previas.some((linea) => linea.productId === producto.id)
        ? previas.map((linea) =>
            linea.productId === producto.id
              ? { ...linea, cantidad: String((parseInt(linea.cantidad, 10) || 0) + 1) }
              : linea
          )
        : [
            ...previas,
            {
              productId: producto.id,
              nombre: producto.name,
              code: producto.code,
              precio: producto.price,
              cantidad: "1",
            },
          ]
    );
  };

  const cambiarCantidad = (productId: number, cantidad: string) =>
    setLineas((previas) =>
      previas.map((linea) => (linea.productId === productId ? { ...linea, cantidad } : linea))
    );

  const quitarProducto = (productId: number) =>
    setLineas((previas) => previas.filter((linea) => linea.productId !== productId));

  const crearClienta = async () => {
    const nombre = nombreNueva.trim();
    const apellido = apellidoNueva.trim();
    const telefono = telefonoNueva.trim();
    if (!nombre || !apellido) {
      setError("Nombre y apellido son obligatorios");
      return;
    }
    setPending(true);
    const result = await createCustomer({
      name: nombre,
      surname: apellido,
      ...(telefono ? { phone: telefono } : {}),
    });
    setPending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "Error al crear la clienta");
      return;
    }
    const creada = result.data as unknown as ClienteOption;
    setClientes((previos) => [...previos, creada]);
    setCustomerId(String(creada.id));
    setNuevaClienta(false);
    setNombreNueva("");
    setApellidoNueva("");
    setTelefonoNueva("");
    setError(null);
  };

  const reset = () => {
    setCustomerId("");
    setCanalId("");
    setLineas([]);
    setSenaMonto("");
    setSenaMedio("EFECTIVO");
    setVenceEl("");
    setError(null);
    setNuevaClienta(false);
    setNombreNueva("");
    setApellidoNueva("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!customerId) return setError("Elegí una clienta");
    if (!canalId) return setError("Elegí el canal de venta");
    if (sucursalId === null) return setError("Elegí la sucursal");

    const items = lineas
      .map((linea) => ({
        productId: linea.productId,
        cantidad: parseInt(linea.cantidad, 10),
      }))
      .filter((item) => Number.isInteger(item.cantidad) && item.cantidad > 0);
    if (items.length === 0) return setError("Agregá al menos un producto");

    const monto = Number(senaMonto);
    setPending(true);
    const result = await createPedido({
      customerId: Number(customerId),
      canalId: Number(canalId),
      branchId: sucursalId,
      items,
      ...(monto > 0 ? { sena: { monto, metodo: senaMedio } } : {}),
      // Mediodía local: la fecha del campo es un día, no un instante.
      ...(venceEl ? { venceEl: `${venceEl}T12:00:00` } : {}),
    });
    setPending(false);

    if (!result.success) {
      setError(result.error ?? "Error al crear el pedido");
      return;
    }
    reset();
    onCreated();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim backdrop-blur-md md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pedido-form-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 animate-slide-up md:max-w-2xl md:rounded-2xl md:animate-scale-in md:max-h-[85vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="pedido-form-title" className="min-w-0 text-xl font-semibold text-ink">
            Nuevo pedido
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-icon btn-round hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="pedido-clienta">
              Clienta
            </label>
            <select
              id="pedido-clienta"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={campo}
            >
              <option value="">Elegí una clienta…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {ETIQUETA_CLIENTE(cliente)}
                </option>
              ))}
            </select>

            {nuevaClienta ? (
              <div className="mt-2 space-y-2 rounded-xl border border-hairline bg-surface-soft p-3">
                <input
                  value={nombreNueva}
                  onChange={(event) => setNombreNueva(event.target.value)}
                  placeholder="Nombre"
                  aria-label="Nombre"
                  className={campo}
                />
                <input
                  value={apellidoNueva}
                  onChange={(event) => setApellidoNueva(event.target.value)}
                  placeholder="Apellido"
                  aria-label="Apellido"
                  className={campo}
                />
                <input
                  value={telefonoNueva}
                  onChange={(event) => setTelefonoNueva(event.target.value)}
                  placeholder="Teléfono (opcional)"
                  aria-label="Teléfono"
                  className={campo}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={crearClienta}
                    disabled={pending}
                    className="btn btn-secondary flex-1"
                  >
                    Crear clienta
                  </button>
                  <button
                    type="button"
                    onClick={() => setNuevaClienta(false)}
                    className="btn btn-ghost"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNuevaClienta(true)}
                className="btn btn-ghost mt-1"
              >
                Nueva clienta
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="pedido-canal">
              Canal de venta
            </label>
            <select
              id="pedido-canal"
              value={canalId}
              onChange={(event) => setCanalId(event.target.value)}
              className={campo}
            >
              <option value="">Elegí el canal…</option>
              {canales.map((canal) => (
                <option key={canal.id} value={canal.id}>
                  {canal.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Productos</span>
            <div className="mt-1">
              <ProductSearch mode="inline" products={catalogo} onSelect={agregarProducto} />
            </div>

            {lineas.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                Buscá y tocá un producto para sumarlo al pedido.
              </p>
            ) : (
              <ul aria-label="Productos del pedido" className="mt-2 space-y-2">
                {lineas.map((linea) => (
                  <li
                    key={linea.productId}
                    className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{linea.nombre}</p>
                      <p className="text-xs text-ink-muted">
                        {linea.code} · {plata(linea.precio)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={linea.cantidad}
                      onChange={(event) =>
                        cambiarCantidad(linea.productId, event.target.value)
                      }
                      aria-label={`Cantidad de ${linea.nombre}`}
                      className="w-16 min-h-[44px] rounded-xl border border-hairline px-2 py-2 text-right text-sm tabular-nums text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => quitarProducto(linea.productId)}
                      aria-label={`Quitar ${linea.nombre}`}
                      className="btn btn-icon btn-round min-h-[44px] min-w-[44px] hover:bg-surface-strong"
                    >
                      <svg className="h-5 w-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-2 text-right text-sm font-semibold text-ink">
              Total: {plata(total)}
            </p>
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Sucursal</span>
            <div className="mt-1">
              <BranchPicker
                branches={branches}
                value={sucursalId}
                onChange={setSucursalId}
                label="Sucursal del pedido"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor="pedido-sena">
                Seña (opcional)
              </label>
              <input
                id="pedido-sena"
                type="number"
                min={0}
                inputMode="decimal"
                value={senaMonto}
                onChange={(event) => setSenaMonto(event.target.value)}
                placeholder="0"
                className={campo}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink" htmlFor="pedido-medio">
                Medio de la seña
              </label>
              <select
                id="pedido-medio"
                value={senaMedio}
                onChange={(event) => setSenaMedio(event.target.value)}
                className={campo}
              >
                {MEDIOS.map((medio) => (
                  <option key={medio.value} value={medio.value}>
                    {medio.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="pedido-vence">
              Vence el (opcional)
            </label>
            <input
              id="pedido-vence"
              type="date"
              value={venceEl}
              onChange={(event) => setVenceEl(event.target.value)}
              className={campo}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-error-surface px-3 py-2 text-sm text-error-ink">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button type="button" onClick={handleClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? "Creando…" : "Crear pedido"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
