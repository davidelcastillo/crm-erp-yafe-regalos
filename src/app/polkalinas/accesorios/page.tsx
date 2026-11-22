import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Accesorios»: los productos con esa categoría. */
export const dynamic = "force-dynamic";

export default async function AccesoriosPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Accesorios",
    rutaBase: "/polkalinas/accesorios",
    grupoFijo: "accesorios",
  });
}
