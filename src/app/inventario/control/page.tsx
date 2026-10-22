"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closeStockControl,
  getLastClosedStockControl,
  getStockControl,
  saveStockControlCounts,
  startStockControl,
} from "@/app/actions/stockControl";
import { getBranchOptions } from "@/app/actions/branch";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { ValueChange } from "@/components/ui/ValueChange";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type {
  StockControlDecision,
  StockControlReceipt,
} from "@/lib/stock-control-receipt";

/**
 * Control de stock por sucursal (S1, S2, S9, S10).
 *
 * Se cuenta la mercadería de una sucursal contra el stock del sistema. Cada
 * diferencia tiene dos salidas y ninguna se aplica sola: **pendiente** deja el
 * teórico a la vista para seguir buscando la mercadería y **aceptar** ajusta el
 * stock a lo contado al cerrar. El cierre con ajustes pide el motivo y descarga
 * el PDF del ajuste.
 */

type ControlItem = {
  productId: number;
  code: string;
  name: string;
  price: number;
  systemStock: number;
  countedStock: number;
  decision: StockControlDecision;
};

type Control = {
  id: number;
  branchId: number;
  branchName: string;
  branchCode: string;
  status: "DRAFT" | "CLOSED";
  startedAt: string;
  closedAt: string | null;
  reason: string | null;
  items: ControlItem[];
};

type UltimoControl = { id: number; closedAt: string | null; closedBy: string | null };

const formatDay = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(iso))
    : "";

export default function ControlStockPage() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  // Arranca en `true`: sin esto la página muestra el vacío «No hay sucursales
  // activas» mientras la lista todavía viaja (S1).
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [ultimo, setUltimo] = useState<UltimoControl | null>(null);
  const [control, setControl] = useState<Control | null>(null);
  const [reusado, setReusado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<StockControlReceipt | null>(null);

  // El encabezado se mueve solo y el degradé de marca se retira al hacer scroll
  // (S10, S11). Con movimiento reducido queda quieto.
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 160], [0, 16]);
  const brandOpacity = useTransform(scrollY, [0, 140], [1, 0.45]);
  const reduceMotion = useReducedMotion();

  // Las sucursales se eligen en una lista grande (paso 1), no en un desplegable
  // del encabezado: en el celular el desplegable quedaba fuera de la vista.
  useEffect(() => {
    let vivo = true;
    getBranchOptions()
      .then((resultado) => {
        if (vivo && resultado.success) setBranches(resultado.data ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setBranchesLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Al cambiar de sucursal se descarta el control en pantalla: el conteo de una
  // sucursal no se mezcla con el de otra.
  useEffect(() => {
    setControl(null);
    setReusado(false);
    setCierre(null);
    setMotivo("");
    setError(null);
    if (branchId === null) {
      setUltimo(null);
      setLoading(false);
      return;
    }

    let vivo = true;
    setLoading(true);
    getLastClosedStockControl({ branchId })
      .then((resultado) => {
        if (!vivo) return;
        if (resultado.success) {
          setUltimo((resultado.data as UltimoControl | null) ?? null);
        } else {
          setError(resultado.error);
        }
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });

    return () => {
      vivo = false;
    };
  }, [branchId]);

  const iniciar = useCallback(async () => {
    if (branchId === null) return;
    setIniciando(true);
    setError(null);
    try {
      const abierto = await startStockControl({ branchId });
      if (!abierto.success) {
        setError(abierto.error);
        return;
      }
      const detalle = await getStockControl({ controlId: abierto.data.controlId });
      if (!detalle.success) {
        setError(detalle.error);
        return;
      }
      setControl(detalle.data as unknown as Control);
      setReusado(abierto.data.reused);
      setMotivo((detalle.data as unknown as Control).reason ?? "");
    } finally {
      setIniciando(false);
    }
  }, [branchId]);

  const cambiarConteo = (productId: number, countedStock: number) =>
    setControl((actual) =>
      actual
        ? {
            ...actual,
            items: actual.items.map((item) =>
              item.productId === productId
                ? { ...item, countedStock: Math.max(0, Math.trunc(countedStock) || 0) }
                : item
            ),
          }
        : actual
    );

  const decidir = (productId: number, decision: StockControlDecision) =>
    setControl((actual) =>
      actual
        ? {
            ...actual,
            items: actual.items.map((item) =>
              item.productId === productId ? { ...item, decision } : item
            ),
          }
        : actual
    );

  /** Atajo: todas las diferencias a la misma salida, de una sola vez. */
  const decidirTodas = (decision: StockControlDecision) =>
    setControl((actual) =>
      actual
        ? {
            ...actual,
            items: actual.items.map((item) =>
              item.countedStock !== item.systemStock ? { ...item, decision } : item
            ),
          }
        : actual
    );

  const { diferencias, aceptadas, pendientes } = useMemo(() => {
    const conDiferencia = (control?.items ?? []).filter(
      (item) => item.countedStock !== item.systemStock
    );
    return {
      diferencias: conDiferencia.length,
      aceptadas: conDiferencia.filter((item) => item.decision === "ACCEPTED").length,
      pendientes: conDiferencia.filter((item) => item.decision === "PENDING").length,
    };
  }, [control]);

  const borrador = () => ({
    controlId: control!.id,
    // El motivo se guarda con el borrador para no perderlo al retomar el control.
    reason: motivo.trim() || undefined,
    items: control!.items.map((item) => ({
      productId: item.productId,
      countedStock: item.countedStock,
      decision: item.decision,
    })),
  });

  const guardar = async () => {
    if (!control) return;
    setGuardando(true);
    setError(null);
    try {
      const resultado = await saveStockControlCounts(borrador());
      if (!resultado.success) setError(resultado.error);
    } finally {
      setGuardando(false);
    }
  };

  const descargarPdf = async (receipt: StockControlReceipt) => {
    const { generateStockControlPdf } = await import("@/lib/utils/stock-control-pdf");
    const bytes = await generateStockControlPdf(receipt);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `control-stock-${receipt.branchCode}-${receipt.controlId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const cerrar = async () => {
    if (!control) return;
    setCerrando(true);
    setError(null);
    try {
      // El cierre ajusta a partir de lo guardado: primero se persiste el conteo.
      const guardado = await saveStockControlCounts(borrador());
      if (!guardado.success) {
        setError(guardado.error);
        return;
      }
      const resultado = await closeStockControl({
        controlId: control.id,
        reason: motivo.trim() || undefined,
      });
      if (!resultado.success) {
        setError(resultado.error);
        return;
      }
      const receipt = resultado.data.receipt as StockControlReceipt;
      setCierre(receipt);
      setControl({ ...control, status: "CLOSED", closedAt: receipt.closedAt, reason: receipt.reason });
      try {
        await descargarPdf(receipt);
      } catch {
        setError(
          "El control ya se cerró, pero no se pudo generar el PDF. Reintentá la descarga sin repetir el cierre."
        );
      }
    } finally {
      setCerrando(false);
    }
  };

  const ocupado = iniciando || guardando || cerrando;

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main>
        <div className="relative isolate pb-16">
          {/* Superficie decorativa: se atenua al scrollear (S10). Los controles
              de abajo no se tocan. */}
          <motion.div
            className="brand-gradient pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={reduceMotion ? undefined : { opacity: brandOpacity }}
          />
          {/* Parallax: solo el encabezado se mueve (S11). */}
          <motion.div style={reduceMotion ? undefined : { y: headerY }}>
            <PageHeader
              title="Control de stock"
              menuItems={[{ label: "Volver al inventario", href: "/inventario" }]}
            />
          </motion.div>
        </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {/* El regreso estaba sólo en el menú ☰: ahora se ve, con target táctil. */}
          <Link
            href="/inventario"
            className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong touch-manipulation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inventario
          </Link>

          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-error-surface px-4 py-3 text-sm text-error-ink">
              {error}
            </p>
          )}

          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {control ? "Paso 2 de 2 · Contar y decidir" : "Paso 1 de 2 · Elegí la sucursal"}
          </p>

          {!control && (
            <section aria-label="Sucursal del control">
              {branchesLoading ? (
                // Las formas son decorativas (`aria-hidden`): el estado lo anuncia
                // el `Spinner` y la sección ya tiene su rótulo, sin repetirlo.
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2" aria-hidden="true">
                  <Skeleton className="h-[44px] rounded-2xl" />
                  <Skeleton className="h-[44px] rounded-2xl" />
                  <Skeleton className="h-[44px] rounded-2xl" />
                  <Skeleton className="h-[44px] rounded-2xl" />
                </div>
              ) : (
                <BranchPicker
                  branches={branches}
                  value={branchId}
                  onChange={setBranchId}
                  columns={2}
                  label="Sucursal del control"
                />
              )}
              {branchId === null && (
                <p className="mt-2 text-sm text-ink-muted">
                  Elegí una sucursal para contar su mercadería y ver las diferencias contra el stock del sistema.
                </p>
              )}
            </section>
          )}

          {branchId !== null && loading && <Spinner label="Cargando el último control" />}

          {branchId !== null && !loading && !control && (
            <section className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4">
              <h2 className="text-base font-semibold text-ink">Contar la mercadería</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {ultimo
                  ? `Último control cerrado: ${formatDay(ultimo.closedAt)}.`
                  : "Esta sucursal todavía no tiene un control cerrado."}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Se abre un borrador con el stock del sistema. Nada cambia hasta que aceptes una
                diferencia y cierres el control.
              </p>
              <button type="button" onClick={iniciar} disabled={ocupado} className="btn btn-primary mt-4 w-full md:w-auto">
                {iniciando ? "Abriendo…" : "Iniciar control"}
              </button>
            </section>
          )}

          {control && (
            <>
              <section className="rounded-2xl border border-hairline bg-surface-soft p-4">
                <h2 className="text-base font-semibold text-ink">
                  {control.branchName} · control #{control.id}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {control.status === "DRAFT"
                    ? `Borrador abierto el ${formatDay(control.startedAt)}${reusado ? " (retomado)" : ""}.`
                    : `Cerrado el ${formatDay(control.closedAt)}.`}
                </p>
                <p className="mt-1 text-sm text-ink">
                  {/* Un solo nodo de texto: los tests leen la línea completa. */}
                  <ValueChange
                    className="inline-block"
                    key={`${control.items.length}-${diferencias}-${aceptadas}-${pendientes}`}
                  >
                    {`${control.items.length} productos · ${diferencias} con diferencia${
                      diferencias > 0
                        ? ` · ${aceptadas} a ajustar · ${pendientes} pendientes`
                        : ""
                    }`}
                  </ValueChange>
                </p>

                {control.status === "DRAFT" && diferencias > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Atajos de decisión">
                    <button
                      type="button"
                      onClick={() => decidirTodas("PENDING")}
                      className="btn btn-ghost whitespace-nowrap"
                    >
                      Todo pendiente
                    </button>
                    <button
                      type="button"
                      onClick={() => decidirTodas("ACCEPTED")}
                      className="btn btn-ghost whitespace-nowrap"
                    >
                      Aceptar diferencias
                    </button>
                  </div>
                )}
              </section>

              {cierre && (
                <section className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4">
                  <p className="text-sm font-semibold text-positive">
                    Control cerrado: {cierre.adjustedCount} ajustados · {cierre.pendingCount} pendientes.
                  </p>
                  {cierre.pendingCount > 0 && (
                    <p className="mt-1 text-sm text-ink-muted">
                      Las pendientes no tocan el stock: si aparece la mercadería, se registra una
                      entrada desde el inventario.
                    </p>
                  )}
                  <Link href="/inventario" className="btn btn-secondary mt-3 w-full md:w-auto">
                    Volver al inventario
                  </Link>
                </section>
              )}

              <ul className="mt-4 space-y-2">
                {control.items.map((item) => {
                  const diferencia = item.countedStock - item.systemStock;
                  return (
                    <li key={item.productId} className="rounded-2xl border border-hairline bg-surface p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {item.code} · {item.name}
                          </p>
                          <p className="text-xs text-ink-muted">Sistema: {item.systemStock}</p>
                        </div>
                        <div className="shrink-0">
                          <label className="sr-only" htmlFor={`conteo-${item.productId}`}>
                            Cantidad contada de {item.name}
                          </label>
                          <input
                            id={`conteo-${item.productId}`}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            disabled={control.status === "CLOSED"}
                            value={item.countedStock}
                            onChange={(event) => cambiarConteo(item.productId, Number(event.target.value))}
                            className="h-11 w-20 rounded-xl border border-hairline bg-surface px-3 text-right text-sm text-ink disabled:bg-surface-strong"
                          />
                        </div>
                      </div>

                      {diferencia !== 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: diferencia < 0 ? "#b91c1c" : "#15803d" }}
                          >
                            <ValueChange className="inline-block" key={diferencia}>
                              {diferencia < 0 ? `Faltan ${-diferencia}` : `Sobran ${diferencia}`}
                            </ValueChange>
                          </span>
                          <button
                            type="button"
                            aria-pressed={item.decision === "PENDING"}
                            disabled={control.status === "CLOSED"}
                            onClick={() => decidir(item.productId, "PENDING")}
                            className={`btn btn-sm whitespace-nowrap ${item.decision === "PENDING" ? "btn-active" : "btn-ghost"}`}
                          >
                            Pendiente
                          </button>
                          <button
                            type="button"
                            aria-pressed={item.decision === "ACCEPTED"}
                            disabled={control.status === "CLOSED"}
                            onClick={() => decidir(item.productId, "ACCEPTED")}
                            className={`btn btn-sm whitespace-nowrap ${item.decision === "ACCEPTED" ? "btn-active" : "btn-ghost"}`}
                          >
                            Aceptar ajuste
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {control.status === "DRAFT" && (
                <section className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4">
                  <label htmlFor="motivo" className="block text-sm font-semibold text-ink">
                    Motivo del ajuste{diferencias > 0 ? "" : " (opcional sin diferencias)"}
                  </label>
                  <p className="mt-1 text-xs text-ink-muted">
                    Obligatorio si aceptás alguna diferencia: queda en el PDF del ajuste.
                  </p>
                  <input
                    id="motivo"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    maxLength={500}
                    placeholder="Ej.: cierre quincenal, faltante por rotura"
                    className="mt-2 h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm text-ink"
                  />

                  <div className="mt-3 flex flex-col gap-2 md:flex-row">
                    <button
                      type="button"
                      onClick={guardar}
                      disabled={ocupado}
                      className="btn btn-secondary w-full md:w-auto"
                    >
                      {guardando ? "Guardando…" : "Guardar borrador"}
                    </button>
                    <button
                      type="button"
                      onClick={cerrar}
                      disabled={ocupado}
                      className="btn btn-primary w-full md:w-auto"
                    >
                      {cerrando ? "Cerrando…" : "Cerrar control"}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
