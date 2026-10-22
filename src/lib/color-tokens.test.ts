import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * El tema oscuro depende de que **ningún componente fije su color**: si una
 * clase vuelve a traer un hex o un gris propios de Tailwind, esa parte de la
 * interfaz se queda en claro cuando el usuario elige el tema oscuro, y el error
 * no se ve hasta que alguien abre esa pantalla en oscuro. Este barrido lo impide.
 *
 * Los colores del tema se nombran con los tokens de `globals.css`:
 * `bg-surface`, `text-ink-muted`, `border-hairline`, `bg-accent`, …
 */
const RAIZ = join(__dirname, "..");
const CARPETAS = ["app", "components"];
const PROHIBIDOS: RegExp[] = [
  // Cualquier color arbitrario de Tailwind: text-[#222222], bg-[#f8f8f8], …
  /\[#/,
  // El blanco literal no es una superficie: en oscuro tiene que ser `bg-surface`.
  /\bbg-white\b/,
  // Los grises de Tailwind tampoco siguen el tema.
  /\b(?:bg|text|border|divide|ring|placeholder|from|to|via)-gray-\d+/,
];

/** Todos los `.tsx` de las carpetas vigiladas, sin los tests. */
function archivosDeComponentes(carpeta = ""): string[] {
  const encontrados: string[] = [];

  for (const nombre of readdirSync(join(RAIZ, carpeta))) {
    const relativo = join(carpeta, nombre);
    const absoluto = join(RAIZ, relativo);

    if (statSync(absoluto).isDirectory()) {
      encontrados.push(...archivosDeComponentes(relativo));
      continue;
    }
    if (!nombre.endsWith(".tsx") || nombre.endsWith(".test.tsx")) continue;
    encontrados.push(absoluto);
  }

  return encontrados;
}

/** Líneas con alguna clase prohibida, con su archivo y número. */
const ofensas = (archivos: string[]): string[] =>
  archivos.flatMap((archivo) =>
    readFileSync(archivo, "utf8")
      .split("\n")
      .flatMap((linea, indice) =>
        PROHIBIDOS.some((patron) => patron.test(linea))
          ? [`${archivo.slice(RAIZ.length + 1)}:${indice + 1} — ${linea.trim()}`]
          : []
      )
  );

describe("los componentes no fijan colores a mano", () => {
  it("detecta las tres formas de fijar un color (el barrido no se puede quedar mudo)", () => {
    const muestra = [
      '<div className="text-[#222222]" />',
      '<div className="bg-white rounded-xl" />',
      '<div className="border-gray-100" />',
    ];
    for (const linea of muestra) {
      expect(PROHIBIDOS.some((patron) => patron.test(linea))).toBe(true);
    }

    // Y no marca lo que sí sigue el tema.
    const correctas = [
      '<div className="bg-surface text-ink-muted border-hairline" />',
      '<div className="bg-surface/70 text-white" />',
      '<button className="bg-accent text-white" />',
    ];
    for (const linea of correctas) {
      expect(PROHIBIDOS.some((patron) => patron.test(linea))).toBe(false);
    }
  });

  it("no queda ningún color literal en src/app ni en src/components", () => {
    const pendientes = ofensas(CARPETAS.flatMap((carpeta) => archivosDeComponentes(carpeta)));

    // El mensaje nombra archivo y línea de cada pendiente: es el trabajo que falta.
    expect(pendientes.slice(0, 20)).toEqual([]);
    expect(pendientes).toHaveLength(0);
  });
});
