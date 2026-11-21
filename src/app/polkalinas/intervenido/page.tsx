import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Intervenido»: la categoría fija vive en la ruta. */
export const dynamic = "force-dynamic";

export default async function IntervenidoPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Intervenido",
    rutaBase: "/polkalinas/intervenido",
    categoriaFija: "intervenido",
  });
}
