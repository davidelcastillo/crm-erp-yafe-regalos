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
      const chunks = actionChunks(fs.readFileSync(file, "utf8"));

      if (chunks.length === 0) problems.push(`${base}: sin acciones exportadas`);

      for (const { name, body } of chunks) {
        const guard = body.indexOf("requireAdmin(");

        if (guard === -1) problems.push(`${base}:${name} sin guardián`);
        else if (guard > indexOf(body, /\.parse\(/)) {
          problems.push(`${base}:${name} guardián después de la validación Zod`);
        } else if (guard > indexOf(body, /prisma\./)) {
          problems.push(`${base}:${name} guardián después de Prisma`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
