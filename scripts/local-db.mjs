#!/usr/bin/env node
// Corre la suite (o aplica el esquema) contra el stack local de Supabase.
// Existe para que nadie corra tests que escriben datos contra un proyecto remoto.
import { spawn, spawnSync } from "node:child_process";
import { Socket } from "node:net";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONNECT_TIMEOUT_MS = 3000;

/** URL local: DATABASE_URL_TEST explícita o la del stack que esté levantado. */
function resolveLocalUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;

  const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  if (status.status === 0) {
    const match = /^DB_URL="?([^"\r\n]+)"?/m.exec(status.stdout ?? "");
    if (match) return match[1];
  }

  return DEFAULT_LOCAL_URL;
}

/** Rechaza cualquier destino que no sea la máquina local. */
export function assertLocalTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`No pude interpretar la URL de la base: ${rawUrl}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `La base de tests apunta a "${host}", que no es local. Este comando solo corre contra el stack local: levantalo con \`supabase start\`.`
    );
  }

  return { host, port: Number(parsed.port || 5432) };
}

function checkReachable({ host, port }) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function main() {
  const command = process.argv[2] === "push" ? "push" : "test";
  const passthrough = process.argv.slice(3);

  let target;
  let url;
  try {
    url = resolveLocalUrl();
    target = assertLocalTarget(url);
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }

  if (!(await checkReachable(target))) {
    console.error(
      `\nLa base local no responde en ${target.host}:${target.port}. Levantá el stack con \`supabase start\` y volvé a intentar.\n`
    );
    process.exit(1);
  }

  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  const [bin, args] =
    command === "push"
      ? ["npx", ["prisma", "db", "push", "--skip-generate"]]
      : ["npx", ["jest", ...passthrough]];

  console.log(`→ ${bin} ${args.join(" ")} contra ${target.host}:${target.port}`);
  const child = spawn(bin, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => process.exit(code ?? 1));
}

main();
