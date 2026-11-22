/**
 * Clasificación pública de la vidriera en los cuatro grupos del pedido del
 * dueño: Ropa son las prendas (código RP…), Peluches y Accesorios se deciden
 * por el nombre de la categoría sin distinguir mayúsculas, y todo lo demás es
 * «Otros productos».
 */
import { GRUPOS, NOMBRE_GRUPO, grupoDe } from "@/lib/grupos-vidriera";

describe("grupoDe", () => {
  it("toda prenda es Ropa, aunque su categoría se llame Peluches", () => {
    expect(grupoDe({ kind: "PRENDA", categoria: "Peluches" })).toBe("ropa");
    expect(grupoDe({ kind: "PRENDA", categoria: null })).toBe("ropa");
  });

  it("un producto con categoría Peluches, en cualquier capitalización", () => {
    expect(grupoDe({ kind: "PRODUCT", categoria: "Peluches" })).toBe("peluches");
    expect(grupoDe({ kind: "PRODUCT", categoria: "PELUCHES" })).toBe("peluches");
    expect(grupoDe({ kind: "PRODUCT", categoria: "peluches" })).toBe("peluches");
  });

  it("un producto con categoría Accesorios, en cualquier capitalización", () => {
    expect(grupoDe({ kind: "PRODUCT", categoria: "Accesorios" })).toBe("accesorios");
    expect(grupoDe({ kind: "PRODUCT", categoria: "ACCESORIOS" })).toBe("accesorios");
  });

  it("mira todas las categorías del producto, no solo la principal", () => {
    expect(
      grupoDe({ kind: "PRODUCT", categoria: "Perfumes", categorias: ["Perfumes", "Peluches"] })
    ).toBe("peluches");
  });

  it("cualquier otro producto, y el que no tiene categoría, van a Otros productos", () => {
    expect(grupoDe({ kind: "PRODUCT", categoria: "Perfumes" })).toBe("otros");
    expect(grupoDe({ kind: "PRODUCT", categoria: null })).toBe("otros");
    expect(grupoDe({ kind: "PRODUCT" })).toBe("otros");
  });
});

describe("los cuatro grupos", () => {
  it("salen con el nombre que ve el visitante, siempre en el mismo orden", () => {
    expect(GRUPOS.map((grupo) => NOMBRE_GRUPO[grupo])).toEqual([
      "Ropa",
      "Peluches",
      "Accesorios",
      "Otros productos",
    ]);
  });
});
