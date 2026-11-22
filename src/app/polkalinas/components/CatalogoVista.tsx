"use client";

import Link from "next/link";
import { useState } from "react";

import type { VidrieraItem } from "@/app/actions/vidriera";
import { GRUPOS, NOMBRE_GRUPO, grupoDe, type GrupoVidriera } from "@/lib/grupos-vidriera";
import {
  FiltrosCatalogo,
  SelectorOrden,
  type OpcionCategoria,
  type ValoresFiltros,
} from "./FiltrosCatalogo";
import { ProductoCard } from "./ProductoCard";

/**
 * Cuerpo del catálogo público (`main` de `web/catalogo.html`): título y migas,
 * filtros a la izquierda (bottom-sheet en el celu), chips de los filtros
 * activos, el `<select>` de orden y la grilla con la tarjeta compartida.
 *
 * Es cliente porque el sheet y el «Ver más prendas» se abren sin navegar; el
 * filtrado en sí sale de la URL, que arma el formulario. La búsqueda la
 * resuelve la action; el grupo, el talle, el estilo, el precio y las vendidas se
 * aplican acá sobre lo que ya devolvió `getVidriera`.
 */

/** Cuántas piezas se ven antes del «Ver más prendas» del mockup. */
const VISIBLES = 12;

/** Grupo público del ítem: lo manda la action; los fixtures lo calculan. */
const grupoDeItem = (item: VidrieraItem) => item.grupo ?? grupoDe(item);

const ORDEN_TALLES = ["XS", "S", "M", "L", "XL", "XXL", "Único"];

/** Los talles cargados, en el orden de la guía y no alfabético. */
const compararTalles = (a: string, b: string) => {
  const posicion = (talle: string) => {
    const indice = ORDEN_TALLES.indexOf(talle);
    return indice === -1 ? ORDEN_TALLES.length : indice;
  };
  return posicion(a) - posicion(b) || a.localeCompare(b);
};

type CampoQuitable =
  | "categoria"
  | "talle"
  | "estilo"
  | "desde"
  | "hasta"
  | "ocultarVendidas"
  | "q";

/** URL del catálogo con los filtros dados; `quitar` saca el de un chip. */
const url = (
  rutaBase: string,
  valores: ValoresFiltros,
  quitar?: { campo: CampoQuitable; valor?: string }
) => {
  const params = new URLSearchParams();
  if (valores.q) params.set("q", valores.q);
  if (valores.orden && valores.orden !== "nuevas") params.set("orden", valores.orden);
  if (valores.talle) params.set("talle", valores.talle);
  if (valores.desde) params.set("desde", valores.desde);
  if (valores.hasta) params.set("hasta", valores.hasta);
  if (valores.ocultarVendidas) params.set("ocultarVendidas", "1");
  valores.estilo
    .filter((valor) => !(quitar?.campo === "estilo" && quitar.valor === valor))
    .forEach((valor) => params.append("estilo", valor));
  valores.categoria
    .filter((valor) => !(quitar?.campo === "categoria" && quitar.valor === valor))
    .forEach((valor) => params.append("categoria", valor));

  for (const clave of ["q", "talle", "desde", "hasta", "ocultarVendidas"] as const) {
    if (quitar?.campo === clave) params.delete(clave);
  }

  const query = params.toString();
  return query ? `${rutaBase}?${query}` : rutaBase;
};

export function CatalogoVista({
  titulo,
  items,
  valores,
  rutaBase,
  grupoFijo,
}: {
  titulo: string;
  items: VidrieraItem[];
  valores: ValoresFiltros;
  rutaBase: string;
  grupoFijo?: GrupoVidriera;
}) {
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  // El grupo de la ruta entra como uno más del OR: elegir otro en el filtro
  // suma, nunca esconde lo que la página ya estaba mostrando.
  const gruposActivos = [...valores.categoria, ...(grupoFijo ? [grupoFijo] : [])];

  const coincideGrupo = (item: VidrieraItem) =>
    gruposActivos.length === 0 || gruposActivos.includes(grupoDeItem(item));

  /** Ítem que la ruta ya deja fijo (en el catálogo completo, todos). */
  const deLaRuta = (item: VidrieraItem) => !grupoFijo || grupoDeItem(item) === grupoFijo;

  const desde = Number(valores.desde) || 0;
  const hasta = Number(valores.hasta) || 0;
  const filtrados = items.filter(
    (item) =>
      coincideGrupo(item) &&
      (!valores.talle || item.talles?.includes(valores.talle)) &&
      (valores.estilo.length === 0 ||
        valores.estilo.some((estilo) => item.estilos?.includes(estilo))) &&
      (!desde || item.price >= desde) &&
      (!hasta || item.price <= hasta) &&
      (!valores.ocultarVendidas || item.estado !== "VENDIDA")
  );

  const ordenados = [...filtrados];
  if (valores.orden === "precio-asc") ordenados.sort((a, b) => a.price - b.price);
  if (valores.orden === "precio-desc") ordenados.sort((a, b) => b.price - a.price);

  const visibles = verTodas ? ordenados : ordenados.slice(0, VISIBLES);

  // El filtro ofrece los cuatro grupos del pedido, no las taxonomías de prenda
  // ni de producto: el conteo mira solo lo que la ruta ya dejó a la vista.
  const opciones: OpcionCategoria[] = GRUPOS.map((grupo) => ({
    valor: grupo,
    nombre: NOMBRE_GRUPO[grupo],
    conteo: items.filter((item) => deLaRuta(item) && grupoDeItem(item) === grupo).length,
  }));

  const talles = [...new Set(items.flatMap((item) => item.talles ?? []))].sort(compararTalles);

  const estilos = [...new Set(items.flatMap((item) => item.estilos ?? []))].sort((a, b) =>
    a.localeCompare(b)
  );

  const chips: { etiqueta: string; href: string }[] = [
    ...(valores.q ? [{ etiqueta: valores.q, href: url(rutaBase, valores, { campo: "q" }) }] : []),
    ...valores.categoria.map((valor) => ({
      etiqueta: NOMBRE_GRUPO[valor as GrupoVidriera] ?? valor,
      href: url(rutaBase, valores, { campo: "categoria", valor }),
    })),
    ...(valores.talle
      ? [{ etiqueta: `Talle ${valores.talle}`, href: url(rutaBase, valores, { campo: "talle" }) }]
      : []),
    ...valores.estilo.map((valor) => ({
      etiqueta: valor,
      href: url(rutaBase, valores, { campo: "estilo", valor }),
    })),
    ...(valores.desde
      ? [{ etiqueta: `Desde $ ${valores.desde}`, href: url(rutaBase, valores, { campo: "desde" }) }]
      : []),
    ...(valores.hasta
      ? [{ etiqueta: `Hasta $ ${valores.hasta}`, href: url(rutaBase, valores, { campo: "hasta" }) }]
      : []),
    ...(valores.ocultarVendidas
      ? [
          {
            etiqueta: "Ocultar vendidas",
            href: url(rutaBase, valores, { campo: "ocultarVendidas" }),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
      <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 py-2 text-[13px] text-ink-muted">
        <Link href="/polkalinas" className="inline-flex min-h-11 items-center hover:text-ink">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{titulo}</span>
      </nav>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-4">
        <h1 className="font-display text-[30px] leading-tight text-ink italic md:text-[40px]">
          {titulo}
        </h1>
        <p className="text-sm text-ink-muted">
          {ordenados.length === 1 ? "1 publicado" : `${ordenados.length} publicados`}
        </p>
      </div>

      {/* Barra de arriba del celu: «Filtrar» abre el sheet y el orden va al lado. */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setSheetAbierto(true)}
          aria-expanded={sheetAbierto}
          aria-controls="filtros"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink bg-surface px-4 text-[14px] font-semibold text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden md:hidden"
        >
          <svg
            aria-hidden="true"
            className="size-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
          </svg>
          Filtrar{chips.length > 0 ? ` (${chips.length})` : ""}
        </button>

        {chips.length > 0 && (
          <div role="group" aria-label="Filtros activos" className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={`${chip.etiqueta}-${chip.href}`}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-0.5 pl-3 text-[13px] font-semibold text-ink"
              >
                {chip.etiqueta}
                <Link
                  href={chip.href}
                  aria-label={`Quitar filtro ${chip.etiqueta}`}
                  className="inline-flex size-7 items-center justify-center rounded-full hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                >
                  <svg
                    aria-hidden="true"
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </Link>
              </span>
            ))}
          </div>
        )}

        <SelectorOrden valor={valores.orden} />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <FiltrosCatalogo
          valores={valores}
          opciones={opciones}
          talles={talles}
          estilos={estilos}
          rutaBase={rutaBase}
          grupoFijo={grupoFijo}
          abierto={sheetAbierto}
          onCerrar={() => setSheetAbierto(false)}
        />

        <div className="min-w-0 flex-1">
          {ordenados.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {items.length === 0
                ? "Todavía no hay prendas ni productos publicados."
                : "No hay prendas con esos filtros."}
            </p>
          ) : (
            <>
              <ul
                aria-label="Prendas y productos"
                className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6"
              >
                {visibles.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <ProductoCard item={item} />
                  </li>
                ))}
              </ul>

              {!verTodas && ordenados.length > VISIBLES && (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() => setVerTodas(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink px-6 text-[15px] font-semibold text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                  >
                    Ver más prendas
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
