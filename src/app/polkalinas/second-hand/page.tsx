import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Second hand»: la categoría fija vive en la ruta. */
export const dynamic = "force-dynamic";

export default async function SecondHandPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Second hand",
    rutaBase: "/polkalinas/second-hand",
    categoriaFija: "second-hand",
  });
}
