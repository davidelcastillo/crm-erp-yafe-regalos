#!/usr/bin/env node
// Semillas idempotentes de las taxonomías de prendas (U2 de odd/tasks/prendas-pedidos.md).
// Solo inserta lo que falta por nombre; no toca filas existentes.
// Se niega a correr contra cualquier base que no sea local (misma guarda que scripts/local-db.mjs).
import { spawnSync } from "node:child_process";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** URL local: DATABASE_URL_TEST, DATABASE_URL o la del stack que esté levantado. */
function resolveLocalUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  if (status.status === 0) {
    const match = /^DB_URL="?([^"\r\n]+)"?/m.exec(status.stdout ?? "");
    if (match) return match[1];
  }

  return DEFAULT_LOCAL_URL;
}

/** Rechaza cualquier destino que no sea la máquina local. */
function assertLocalTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`No pude interpretar la URL de la base: ${rawUrl}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `La base apunta a "${host}", que no es local. Este script solo siembra el stack local: levantalo con \`supabase start\`.`
    );
  }

  return host;
}

const SEEDS = [
  [
    "condicionPrenda",
    [{ name: "Muy bueno" }, { name: "Bueno" }, { name: "Con detalles" }],
  ],
  [
    "medidaTipo",
    [
      { name: "Ancho (axila a axila)" },
      { name: "Largo total" },
      { name: "Largo de manga" },
    ],
  ],
  [
    "canalVenta",
    [{ name: "WhatsApp" }, { name: "Instagram" }, { name: "TikTok" }, { name: "Local" }],
  ],
  [
    "categoriaPrenda",
    [
      { name: "Second hand", esUnicaPorDefecto: true, codePrefix: "RPH" },
      { name: "Intervenido", esUnicaPorDefecto: true, codePrefix: "RPI" },
      { name: "Nuevo", esUnicaPorDefecto: false, codePrefix: "RP" },
    ],
  ],
  [
    "estiloPrenda",
    [
      { name: "Coquette" },
      { name: "Vintage" },
      { name: "Y2K" },
      { name: "Alternativo" },
      { name: "Romántico" },
    ],
  ],
];

async function main() {
  const url = resolveLocalUrl();
  const host = assertLocalTarget(url);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  console.log(`→ sembrando taxonomías de prendas en ${host}\n`);
  let total = 0;

  try {
    for (const [model, rows] of SEEDS) {
      let insertadas = 0;
      for (const row of rows) {
        // `codePrefix` solo existe en categoriaPrenda: el select se arma por fila.
        const existente = await prisma[model].findFirst({
          where: { name: { equals: row.name, mode: "insensitive" } },
          select: row.codePrefix !== undefined ? { id: true, codePrefix: true } : { id: true },
        });
        if (existente) {
          // U8: las categorías sembradas antes de los prefijos los reciben ahora.
          if (row.codePrefix !== undefined && existente.codePrefix == null) {
            await prisma[model].update({
              where: { id: existente.id },
              data: { codePrefix: row.codePrefix },
            });
            console.log(`categoriaPrenda: prefijo ${row.codePrefix} completado en «${row.name}»`);
          }
          continue;
        }

        await prisma[model].create({ data: row });
        insertadas += 1;
      }
      total += insertadas;
      console.log(
        `${model}: ${insertadas} insertada(s), ${rows.length} sembrada(s) en total`
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${total} fila(s) insertada(s).`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
