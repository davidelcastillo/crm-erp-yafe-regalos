import { baseBranchCode, freeBranchCode } from "./branch-code";

describe("baseBranchCode", () => {
  it("usa las iniciales del nombre en mayúsculas", () => {
    expect(baseBranchCode("Punto Rosa", 39)).toBe("PR");
  });

  it("toma la inicial de cada palabra, descarta símbolos y corta a 10 caracteres", () => {
    // Comportamiento conservado del script original: la inicial de cada palabra,
    // incluidos los números, sin los símbolos.
    expect(baseBranchCode("Casañova 2 - Centro", 7)).toBe("C2C");
    expect(baseBranchCode("Alfa Beta Gamma Delta", 7)).toBe("ABGD");
  });

  it("cae a un código por id cuando el nombre no deja letras", () => {
    expect(baseBranchCode("---", 7)).toBe("BR007");
    expect(baseBranchCode("", 1234)).toBe("BR1234");
  });
});

describe("freeBranchCode", () => {
  it("devuelve el código base cuando está libre", () => {
    expect(freeBranchCode("PR", new Set())).toBe("PR");
  });

  it("agrega un sufijo numérico ante una colisión", () => {
    expect(freeBranchCode("PR", new Set(["PR"]))).toBe("PR01");
    expect(freeBranchCode("PR", new Set(["PR", "PR01", "PR02"]))).toBe("PR03");
  });

  it("corta el base a 8 caracteres cuando agrega sufijo", () => {
    expect(freeBranchCode("ABCDEFGHIJ", new Set(["ABCDEFGHIJ"]))).toBe("ABCDEFGH01");
  });

  it("falla con un mensaje claro si no queda variante libre", () => {
    const taken = new Set(["PR"]);
    for (let counter = 1; counter < 100; counter++) {
      taken.add(`PR${counter.toString().padStart(2, "0")}`);
    }

    expect(() => freeBranchCode("PR", taken)).toThrow(/No hay código libre para "PR"/);
  });
});
