"use client";

import Link from "next/link";

import type { GrupoVidriera } from "@/lib/grupos-vidriera";

/**
 * Filtros del catálogo (`aside.filtros` de `web/catalogo.html`): columna fija de
 * 260px en escritorio y bottom-sheet en el celu, que abre el botón «Filtrar».
 * El formulario es un GET contra la misma ruta, así el estado vive en la URL y
 * el catálogo filtrado es un link compartible.
 */

export type ValoresFiltros = {
  categoria: string[];
  talle: string;
  estilo: string[];
  desde: string;
  hasta: string;
  ocultarVendidas: boolean;
  orden: string;
  q: string;
};

export type OpcionCategoria = { valor: string; nombre: string; conteo: number };

const LEYENDA = "w-full font-semibold text-[15px] text-ink";
const GRUPO = "flex flex-col gap-2 border-0 border-t border-hairline py-4";
const CAMPO =
  "min-h-10 w-full rounded-[10px] border-[1.5px] border-hairline-strong bg-surface px-2.5 text-[15px] text-ink focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";
const CHECK = "flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[15px] text-ink";
const TALLE =
  "inline-flex min-h-10 min-w-11 items-center justify-center rounded-[10px] border-[1.5px] border-hairline-strong bg-surface px-2.5 font-semibold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";

export function FiltrosCatalogo({
  valores,
  opciones,
  talles,
  estilos,
  rutaBase,
  grupoFijo,
  abierto,
  onCerrar,
}: {
  valores: ValoresFiltros;
  opciones: OpcionCategoria[];
  talles: string[];
  estilos: string[];
  rutaBase: string;
  grupoFijo?: GrupoVidriera;
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <aside
      aria-label="Filtros"
      className={`${
        abierto
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[22px] bg-background px-4 pt-4 pb-6 shadow-card"
          : "hidden"
      } md:sticky md:top-36 md:block md:inset-auto md:max-h-none md:w-[260px] md:shrink-0 md:overflow-visible md:rounded-none md:bg-transparent md:p-0 md:shadow-none`}
    >
      <form
        id="filtros"
        method="get"
        action={rutaBase}
        onSubmit={onCerrar}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <strong className="text-[17px] text-ink">Filtrar</strong>
          <span className="flex items-center gap-1">
            <Link
              href={rutaBase}
              className="inline-flex min-h-11 items-center px-2 text-[14px] text-ink hover:text-accent"
            >
              Limpiar
            </Link>
            <button
              type="button"
              aria-label="Cerrar filtros"
              onClick={onCerrar}
              className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden md:hidden"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        </div>

        {/* El buscador del header manda `?q=`: el formulario lo conserva. */}
        {valores.q && <input type="hidden" name="q" value={valores.q} />}

        <fieldset className={GRUPO}>
          <legend className={LEYENDA}>Categoría</legend>
          {opciones.map((opcion) => (
            <label key={opcion.valor} className={CHECK}>
              <input
                type="checkbox"
                name="categoria"
                value={opcion.valor}
                defaultChecked={valores.categoria.includes(opcion.valor)}
                // La ruta filtrada ya trae su grupo: sacarlo es cambiar de página.
                disabled={opcion.valor === grupoFijo}
                className="size-4.5 accent-ink"
              />
              {opcion.nombre}
              <em className="ml-auto text-[13px] text-ink-muted not-italic">{opcion.conteo}</em>
            </label>
          ))}
        </fieldset>

        {/* Solo la ropa tiene talle: en Peluches, Accesorios y Otros no aplica. */}
        {(grupoFijo === undefined || grupoFijo === "ropa") && (
          <fieldset className={GRUPO}>
            <legend className={LEYENDA}>Talle</legend>
            {talles.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Todavía no hay talles cargados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {talles.map((talle) => (
                  <button
                    key={talle}
                    type="submit"
                    name="talle"
                    value={talle}
                    aria-pressed={valores.talle === talle}
                    className={TALLE}
                  >
                    {talle}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {estilos.length > 0 && (
          <fieldset className={GRUPO}>
            <legend className={LEYENDA}>Estilo</legend>
            {estilos.map((estilo) => (
              <label key={estilo} className={CHECK}>
                <input
                  type="checkbox"
                  name="estilo"
                  value={estilo}
                  defaultChecked={valores.estilo.includes(estilo)}
                  className="size-4.5 accent-ink"
                />
                {estilo}
              </label>
            ))}
          </fieldset>
        )}

        <fieldset className={GRUPO}>
          <legend className={LEYENDA}>Precio</legend>
          <div className="flex gap-2.5">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-muted">
              Desde
              <input
                type="number"
                name="desde"
                min={0}
                inputMode="numeric"
                placeholder="$"
                defaultValue={valores.desde}
                className={CAMPO}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-muted">
              Hasta
              <input
                type="number"
                name="hasta"
                min={0}
                inputMode="numeric"
                placeholder="$"
                defaultValue={valores.hasta}
                className={CAMPO}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={GRUPO}>
          <legend className={LEYENDA}>Disponibilidad</legend>
          <label className={CHECK}>
            <input
              type="checkbox"
              name="ocultarVendidas"
              value="1"
              defaultChecked={valores.ocultarVendidas}
              className="size-4.5 accent-ink"
            />
            Ocultar vendidas
          </label>
        </fieldset>

        <button
          type="submit"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 font-semibold text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden md:hidden"
        >
          Ver resultados
        </button>
        <button
          type="submit"
          className="mt-2 hidden min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden md:inline-flex"
        >
          Aplicar filtros
        </button>
      </form>
    </aside>
  );
}

/** El `<select>` del mockup: ordena la grilla sin recargar la página a mano. */
export function SelectorOrden({ valor }: { valor: string }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-ink">
      <span className="text-ink-muted">Ordenar</span>
      <select
        name="orden"
        form="filtros"
        defaultValue={valor || "nuevas"}
        onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
        className="min-h-11 rounded-full border-2 border-ink bg-surface px-3 text-[15px] font-semibold text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
      >
        <option value="nuevas">Más nuevas</option>
        <option value="precio-asc">Menor precio</option>
        <option value="precio-desc">Mayor precio</option>
      </select>
    </label>
  );
}
