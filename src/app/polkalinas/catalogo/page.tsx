import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/**
 * Catálogo público: la entrada sin filtro fijo. El cuerpo vive en
 * `components/CatalogoCuerpo` porque lo comparten las rutas filtradas.
 */
export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Catálogo",
    rutaBase: "/polkalinas/catalogo",
  });
}
