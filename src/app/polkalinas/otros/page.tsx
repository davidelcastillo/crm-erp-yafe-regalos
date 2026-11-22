import { CatalogoCuerpo, type ParamsBusqueda } from "../components/CatalogoCuerpo";

/** Catálogo ya filtrado en «Otros productos»: todo lo que no es prenda, peluche ni accesorio. */
export const dynamic = "force-dynamic";

export default async function OtrosPage({
  searchParams,
}: {
  searchParams: Promise<ParamsBusqueda>;
}) {
  return CatalogoCuerpo({
    searchParams,
    titulo: "Otros productos",
    rutaBase: "/polkalinas/otros",
    grupoFijo: "otros",
  });
}
