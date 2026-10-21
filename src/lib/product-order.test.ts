/**
 * @jest-environment node
 */

/**
 * Orden compartido de las listas de productos (S4): por código —prefijo
 * alfabético y después el número— o por última fecha de modificación.
 */
import { sortProducts } from "@/lib/product-order";

const codigos = (rows: Array<{ code: string }>) => rows.map((row) => row.code);

describe("sortProducts — orden por código (S4)", () => {
  it("ordena AAA001 → AAA099 → BBB888 (ejemplo textual del usuario)", () => {
    const rows = [
      { code: "BBB888" },
      { code: "AAA099" },
      { code: "AAA001" },
    ];

    expect(codigos(sortProducts(rows))).toEqual(["AAA001", "AAA099", "BBB888"]);
  });

  it("compara los dígitos como número, no como texto (AAA9 antes que AAA10)", () => {
    const rows = [{ code: "AAA10" }, { code: "AAA9" }, { code: "AAA001" }];

    expect(codigos(sortProducts(rows))).toEqual(["AAA001", "AAA9", "AAA10"]);
  });

  it("usa codePrefix cuando existe y lo deriva del code cuando es null", () => {
    const rows = [
      // El code dice "XYZ" pero el prefijo registrado es "AAA": manda codePrefix.
      { code: "XYZ001", codePrefix: "AAA" },
      // Sin codePrefix: el prefijo sale del propio code.
      { code: "BBB001", codePrefix: null },
      { code: "AAA500", codePrefix: "AAA" },
    ];

    expect(codigos(sortProducts(rows))).toEqual(["XYZ001", "AAA500", "BBB001"]);
  });

  it("no distingue mayúsculas", () => {
    const rows = [{ code: "aaa010" }, { code: "AAA001" }];

    expect(codigos(sortProducts(rows))).toEqual(["AAA001", "aaa010"]);
  });

  it("no muta la lista original", () => {
    const rows = [{ code: "BBB888" }, { code: "AAA001" }];

    sortProducts(rows);

    expect(codigos(rows)).toEqual(["BBB888", "AAA001"]);
  });
});

describe("sortProducts — orden por última modificación (S4)", () => {
  it("deja primero el updatedAt más reciente, con el código como desempate", () => {
    const rows = [
      { code: "AAA001", updatedAt: new Date("2026-01-01T00:00:00.000Z") },
      { code: "BBB888", updatedAt: new Date("2026-03-01T00:00:00.000Z") },
      { code: "AAA099", updatedAt: new Date("2026-03-01T00:00:00.000Z") },
    ];

    expect(codigos(sortProducts(rows, "updated"))).toEqual([
      "AAA099",
      "BBB888",
      "AAA001",
    ]);
  });

  it("acepta updatedAt serializado como ISO (lo que llega al cliente)", () => {
    const rows = [
      { code: "AAA001", updatedAt: "2026-01-01T00:00:00.000Z" },
      { code: "BBB888", updatedAt: "2026-02-01T00:00:00.000Z" },
    ];

    expect(codigos(sortProducts(rows, "updated"))).toEqual(["BBB888", "AAA001"]);
  });

  it("manda al final las filas sin updatedAt", () => {
    const rows = [
      { code: "AAA001" },
      { code: "BBB888", updatedAt: new Date("2026-02-01T00:00:00.000Z") },
    ];

    expect(codigos(sortProducts(rows, "updated"))).toEqual(["BBB888", "AAA001"]);
  });
});
