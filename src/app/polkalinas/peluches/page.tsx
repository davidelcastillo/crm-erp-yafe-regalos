import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Peluches»: los productos con esa categoría. */
export const dynamic = "force-dynamic";

export default async function PeluchesPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Peluches",
    rutaBase: "/polkalinas/peluches",
    grupoFijo: "peluches",
  });
}
