import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Ropa»: todas las prendas publicadas. */
export const dynamic = "force-dynamic";

export default async function RopaPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Ropa",
    rutaBase: "/polkalinas/ropa",
    grupoFijo: "ropa",
  });
}
