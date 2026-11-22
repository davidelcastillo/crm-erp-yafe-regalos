/**
 * Los cuatro grupos con los que el dueño ordena la tienda pública (pedido del
 * 21/08): **Ropa** son todas las prendas (código RP…), **Peluches** y
 * **Accesorios** se deciden por el nombre de la categoría del producto sin
 * distinguir mayúsculas, y **Otros productos** es todo lo demás. Reemplazan a
 * las etiquetas viejas (Nuevo / Intervenido / Second hand / Cositas).
 */
export type GrupoVidriera = "ropa" | "peluches" | "accesorios" | "otros";

/** Nombre que ve el visitante en el header, la home y los filtros. */
export const NOMBRE_GRUPO: Record<GrupoVidriera, string> = {
  ropa: "Ropa",
  peluches: "Peluches",
  accesorios: "Accesorios",
  otros: "Otros productos",
};

/** Orden fijo de los cuatro grupos en la UI. */
export const GRUPOS: GrupoVidriera[] = ["ropa", "peluches", "accesorios", "otros"];

/**
 * Grupo público del ítem. La prenda siempre es Ropa; el producto entra en
 * Peluches o Accesorios si **alguna** de sus categorías se llama así (la base
 * tiene «Peluches» y «PELUCHES», por eso se compara en minúsculas).
 */
export const grupoDe = (item: {
  kind: "PRENDA" | "PRODUCT";
  categoria?: string | null;
  categorias?: string[];
}): GrupoVidriera => {
  if (item.kind === "PRENDA") return "ropa";
  const nombres = (item.categorias ?? (item.categoria ? [item.categoria] : [])).map((nombre) =>
    nombre.trim().toLowerCase()
  );
  if (nombres.includes("peluches")) return "peluches";
  if (nombres.includes("accesorios")) return "accesorios";
  return "otros";
};
