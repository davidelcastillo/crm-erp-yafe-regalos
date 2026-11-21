import { notFound } from "next/navigation";

import { getVidriera } from "@/app/actions/vidriera";
import { CatalogoVista } from "./CatalogoVista";
import type { CategoriaSlug, ValoresFiltros } from "./FiltrosCatalogo";
import { TiendaFooter, TiendaHeader } from "./TiendaHeader";

/**
 * Cuerpo del catálogo público (`web/catalogo.html`, T4/S2/S4): prendas y
 * productos publicados en el canal «Web», sin login y de solo lectura. Filtros
 * a la izquierda, chips de los filtros activos y la grilla con la tarjeta.
 *
 * Lo comparten la página del catálogo y las rutas filtradas (`nuevo`,
 * `second-hand`, …), que solo cambian el título, la ruta y la categoría fija.
 * El estado de los filtros vive en la URL (`?categoria=`, `?talle=`, `?orden=`,
 * …); `?categoria=` acepta el id numérico y el slug del header.
 */

/** `searchParams` de Next, tal como llega a cualquier página. */
export type ParamsBusqueda = Record<string, string | string[] | undefined>;

const uno = (valor: string | string[] | undefined) =>
  (Array.isArray(valor) ? valor[0] : valor) ?? "";
const varios = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor : valor ? [valor] : [];

const leerFiltros = (params: ParamsBusqueda): ValoresFiltros => ({
  categoria: varios(params.categoria),
  talle: uno(params.talle),
  estilo: varios(params.estilo),
  desde: uno(params.desde),
  hasta: uno(params.hasta),
  ocultarVendidas: uno(params.ocultarVendidas) === "1",
  orden: uno(params.orden),
  q: uno(params.q),
});

/** Id numérico de `?categoria=7`: la action filtra por id; el slug se filtra acá. */
const categoriaIdDe = (categorias: string[]) => {
  const id = Number(categorias.find((valor) => Number(valor) > 0));
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

export async function CatalogoCuerpo({
  searchParams,
  titulo,
  rutaBase,
  categoriaFija,
}: {
  searchParams: Promise<ParamsBusqueda>;
  titulo: string;
  rutaBase: string;
  categoriaFija?: CategoriaSlug;
}) {
  const valores = leerFiltros(await searchParams);
  const resultado = await getVidriera({
    categoriaId: categoriaIdDe(valores.categoria),
    q: valores.q || undefined,
  });
  if (!resultado.success) notFound();

  return (
    <>
      <TiendaHeader />

      <main>
        <CatalogoVista
          titulo={titulo}
          items={resultado.data.items}
          categorias={resultado.data.categorias}
          valores={valores}
          rutaBase={rutaBase}
          categoriaFija={categoriaFija}
        />
      </main>

      <TiendaFooter />
    </>
  );
}
