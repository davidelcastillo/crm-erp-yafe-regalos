/**
 * @jest-environment node
 *
 * Red de seguridad estructural de la autorización (AGENTS.md §0.2).
 *
 * Los casos de rechazo de cada módulo prueban el mecanismo, pero no todas las
 * acciones tienen uno: `jest.setup.ts` mockea el guardián como autorizado, así
 * que borrar el `requireAdmin()` de una acción sin caso propio dejaría la suite
 * entera en verde. Este barrido lee las fuentes y exige que, en cada Server
 * Action interna, el guardián aparezca antes del primer `parse(` (Zod) y del
 * primer `prisma.`, que es lo que pide S5 de `odd/tasks/autorizacion-acciones.md`.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const ACTIONS_DIRS = [
  path.join(ROOT, "src", "app", "actions"),
  path.join(ROOT, "src", "actions"),
];

/** Excluidos a propósito (S6): catálogo público de solo lectura y login/logout. */
const EXCLUDED = ["inventory.external.ts", "auth.ts"];

const sourceFiles = (): string[] =>
  ACTIONS_DIRS.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => path.join(dir, name))
  );

const isExcluded = (file: string) => EXCLUDED.includes(path.basename(file));

/** Cada bloque va desde `export async function` hasta el próximo (o el final). */
const actionChunks = (source: string): { name: string; body: string }[] => {
  const heads = [...source.matchAll(/export async function (\w+)\s*\(/g)];
  return heads.map((head, index) => ({
    name: head[1],
    body: source.slice(head.index, heads[index + 1]?.index ?? source.length),
  }));
};

/** Helpers privados del mismo archivo (`async function …`), por nombre.
 * Acepta genéricos (`crear<T>(…)`) entre el nombre y la firma. */
const helperChunks = (source: string): Map<string, string> => {
  const heads = [...source.matchAll(/async function (\w+)(?:<[^>]*>)?\s*\(/g)];
  return new Map(
    heads.map((head, index) => [
      head[1],
      source.slice(head.index, heads[index + 1]?.index ?? source.length),
    ])
  );
};

/** `true` si el guardián aparece antes del primer Zod y del primer Prisma. */
const guardaAntesDeTodo = (body: string): boolean => {
  const guard = body.indexOf("requireAdmin(");
  return (
    guard !== -1 &&
    guard <= indexOf(body, /\.parse\(/) &&
    guard <= indexOf(body, /prisma\./)
  );
};

const indexOf = (body: string, pattern: RegExp): number => {
  const found = body.search(pattern);
  return found === -1 ? Number.POSITIVE_INFINITY : found;
};

describe("autorización admin en las Server Actions internas", () => {
  test("el barrido encuentra los módulos de acciones, no una lista vacía", () => {
    expect(sourceFiles().length).toBeGreaterThanOrEqual(10);
  });

  test("los módulos excluidos a propósito no llevan guardián", () => {
    const excluded = sourceFiles().filter(isExcluded);

    expect(excluded.map((file) => path.basename(file)).sort()).toEqual([...EXCLUDED].sort());
    for (const file of excluded) {
      expect(fs.readFileSync(file, "utf8")).not.toContain("requireAdmin");
    }
  });

  test("cada acción interna pide sesión admin antes de Zod y de Prisma", () => {
    const problems: string[] = [];

    for (const file of sourceFiles().filter((name) => !isExcluded(name))) {
      const base = path.basename(file);
      const source = fs.readFileSync(file, "utf8");
      // Helpers del mismo archivo: una acción puede delegar todo su trabajo en uno
      // de ellos (p. ej. `prendaTaxonomy.ts`); el guardián vive en el helper y el
      // requisito se verifica sobre su cuerpo.
      const chunks = actionChunks(source);
      const helpers = helperChunks(source);

      if (chunks.length === 0) problems.push(`${base}: sin acciones exportadas`);

      for (const { name, body } of chunks) {
        if (guardaAntesDeTodo(body)) continue;

        // Sin guardián propio: se acepta solo si la acción no hace trabajo
        // directo (Zod/Prisma) y delega en un helper guardado del mismo archivo.
        const haceTrabajoDirecto =
          indexOf(body, /\.parse\(/) !== Number.POSITIVE_INFINITY ||
          indexOf(body, /prisma\./) !== Number.POSITIVE_INFINITY;
        const delegaGuardado = [...helpers.entries()].some(
          ([helper, helperBody]) =>
            new RegExp(`\\b${helper}\\(`).test(body) && guardaAntesDeTodo(helperBody)
        );

        if (haceTrabajoDirecto || !delegaGuardado) {
          problems.push(`${base}:${name} sin guardián`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
