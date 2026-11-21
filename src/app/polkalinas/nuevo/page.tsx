import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/**
 * Catálogo ya filtrado en «Nuevo» (pedido del dueño): es el catálogo de
 * siempre, pero con la categoría fija en la ruta y no en la URL.
 */
export const dynamic = "force-dynamic";

export default async function NuevoPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Nuevo",
    rutaBase: "/polkalinas/nuevo",
    categoriaFija: "nuevo",
  });
}
