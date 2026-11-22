import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Cositas»: los productos normales, no las prendas. */
export const dynamic = "force-dynamic";

export default async function CositasPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Cositas",
    rutaBase: "/polkalinas/cositas",
    categoriaFija: "cositas",
  });
}
