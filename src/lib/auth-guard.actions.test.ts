/**
 * @jest-environment node
 *
 * Cobertura dinámica del rechazo: cada Server Action interna, llamada con una
 * sesión que no es `admin`, tiene que devolver «No autorizado».
 *
 * El guardián corre antes de Zod y de Prisma (S5 de
 * `odd/tasks/autorizacion-acciones.md`), así que el payload de entrada es
 * irrelevante cuando la sesión está denegada: por eso basta con `{}` para las
 * acciones internas, sin fabricar un payload válido por acción.
 *
 * Sumar un módulo nuevo de acciones obliga a importarlo acá (ver `MODULES`): el
 * barrido compara las funciones exportadas en disco contra las importadas y
 * falla nombrando el archivo y la acción que falta.
 *
 * Esta suite cubre lo que el barrido estructural (`auth-guard.coverage.test.ts`)
 * no puede: que el resultado del guardián se **use**. Una acción que llame a
 * `requireAdmin()` y siga de largo devuelve acá un error de validación o de
 * Prisma en lugar de «No autorizado».
 */
import fs from "fs";
import path from "path";

import * as branchActions from "@/app/actions/branch";
import * as cashActions from "@/app/actions/cash";
import * as categoryActions from "@/app/actions/category";
import * as customerActions from "@/app/actions/customer";
import * as dashboardActions from "@/app/actions/dashboard";
import * as inventoryActions from "@/app/actions/inventory";
import * as productActions from "@/app/actions/product";
import * as purchaseActions from "@/app/actions/purchase";
import * as saleActions from "@/app/actions/sale";
import * as stockControlActions from "@/app/actions/stockControl";
import * as labelPrintActions from "@/actions/label-print";

// Ninguna acción denegada debe llegar a Prisma; el mock vacío hace que, si
// alguna lo hiciera, falle en el acto en vez de tocar una base.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

const ROOT = path.join(__dirname, "..", "..");
const ACTIONS_DIRS = [
  path.join(ROOT, "src", "app", "actions"),
  path.join(ROOT, "src", "actions"),
];

/** Excluidos a propósito (S6): catálogo público de solo lectura y login/logout. */
const EXCLUDED = ["inventory.external.ts", "auth.ts"];

const MODULES: Record<string, Record<string, unknown>> = {
  "branch.ts": branchActions as unknown as Record<string, unknown>,
  "cash.ts": cashActions as unknown as Record<string, unknown>,
  "category.ts": categoryActions as unknown as Record<string, unknown>,
  "customer.ts": customerActions as unknown as Record<string, unknown>,
  "dashboard.ts": dashboardActions as unknown as Record<string, unknown>,
  "inventory.ts": inventoryActions as unknown as Record<string, unknown>,
  "product.ts": productActions as unknown as Record<string, unknown>,
  "purchase.ts": purchaseActions as unknown as Record<string, unknown>,
  "sale.ts": saleActions as unknown as Record<string, unknown>,
  "stockControl.ts": stockControlActions as unknown as Record<string, unknown>,
  "label-print.ts": labelPrintActions as unknown as Record<string, unknown>,
};

const internalFiles = (): string[] =>
  ACTIONS_DIRS.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => path.join(dir, name))
  ).filter((file) => !EXCLUDED.includes(path.basename(file)));

const exportedNames = (source: string): string[] =>
  [...source.matchAll(/export async function (\w+)\s*\(/g)].map((match) => match[1]);

type ActionResult = { success: boolean; error?: string };

describe("ninguna acción interna atiende sin sesión admin", () => {
  const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>("@/lib/auth-guard");

  beforeEach(() => {
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({ ok: false, error: "No autorizado" });
  });

  test("las 64 acciones exportadas devuelven «No autorizado»", async () => {
    const problems: string[] = [];
    let visited = 0;

    for (const file of internalFiles()) {
      const base = path.basename(file);
      const actions = MODULES[base];

      for (const name of exportedNames(fs.readFileSync(file, "utf8"))) {
        const action = actions?.[name];

        if (typeof action !== "function") {
          problems.push(`${base}:${name} no está importada en esta suite`);
          continue;
        }

        visited++;
        const result = (await (action as (input: unknown) => Promise<ActionResult>)({})) as ActionResult;

        if (result?.success !== false || result.error !== "No autorizado") {
          problems.push(`${base}:${name} no rechazó: ${JSON.stringify(result)}`);
        }
      }
    }

    expect(problems).toEqual([]);
    expect(visited).toBeGreaterThanOrEqual(64);
  });
});
