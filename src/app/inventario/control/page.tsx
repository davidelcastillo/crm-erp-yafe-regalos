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
import { BranchFilterDropdown } from "@/components/ui/BranchFilterDropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
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
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Control de stock"
            right={
              <BranchFilterDropdown
                selectedId={branchId}
                onValueChange={setBranchId}
                label="Sucursal del control"
              />
            }
            menuItems={[{ label: "Volver al inventario", href: "/inventario" }]}
          />
        </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-[#ffe4ea] px-4 py-3 text-sm text-[#8f0020]">
              {error}
            </p>
          )}

          {branchId === null && (
            <p className="text-sm text-[#6a6a6a]">
              Elegí una sucursal para contar su mercadería y ver las diferencias contra el stock del sistema.
            </p>
          )}

          {branchId !== null && loading && <Spinner label="Cargando el último control" />}

          {branchId !== null && !loading && !control && (
            <section className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
              <h2 className="text-base font-semibold text-[#222222]">Contar la mercadería</h2>
              <p className="mt-1 text-sm text-[#6a6a6a]">
                {ultimo
                  ? `Último control cerrado: ${formatDay(ultimo.closedAt)}.`
                  : "Esta sucursal todavía no tiene un control cerrado."}
              </p>
              <p className="mt-1 text-sm text-[#6a6a6a]">
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
              <section className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                <h2 className="text-base font-semibold text-[#222222]">
                  {control.branchName} · control #{control.id}
                </h2>
                <p className="mt-1 text-sm text-[#6a6a6a]">
                  {control.status === "DRAFT"
                    ? `Borrador abierto el ${formatDay(control.startedAt)}${reusado ? " (retomado)" : ""}.`
                    : `Cerrado el ${formatDay(control.closedAt)}.`}
                </p>
                <p className="mt-1 text-sm text-[#222222]">
                  {control.items.length} productos · {diferencias} con diferencia
                  {diferencias > 0 ? ` · ${aceptadas} a ajustar · ${pendientes} pendientes` : ""}
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
                <section className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                  <p className="text-sm font-semibold text-[#15803d]">
                    Control cerrado: {cierre.adjustedCount} ajustados · {cierre.pendingCount} pendientes.
                  </p>
                  {cierre.pendingCount > 0 && (
                    <p className="mt-1 text-sm text-[#6a6a6a]">
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
                    <li key={item.productId} className="rounded-2xl border border-black/10 bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#222222]">
                            {item.code} · {item.name}
                          </p>
                          <p className="text-xs text-[#6a6a6a]">Sistema: {item.systemStock}</p>
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
                            className="h-11 w-20 rounded-xl border border-[#dddddd] bg-white px-3 text-right text-sm text-[#222222] disabled:bg-[#f2f2f2]"
                          />
                        </div>
                      </div>

                      {diferencia !== 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: diferencia < 0 ? "#b91c1c" : "#15803d" }}
                          >
                            {diferencia < 0 ? `Faltan ${-diferencia}` : `Sobran ${diferencia}`}
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
                <section className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                  <label htmlFor="motivo" className="block text-sm font-semibold text-[#222222]">
                    Motivo del ajuste{diferencias > 0 ? "" : " (opcional sin diferencias)"}
                  </label>
                  <p className="mt-1 text-xs text-[#6a6a6a]">
                    Obligatorio si aceptás alguna diferencia: queda en el PDF del ajuste.
                  </p>
                  <input
                    id="motivo"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    maxLength={500}
                    placeholder="Ej.: cierre quincenal, faltante por rotura"
                    className="mt-2 h-11 w-full rounded-xl border border-[#dddddd] bg-white px-3 text-sm text-[#222222]"
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
