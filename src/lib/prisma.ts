import { PrismaClient } from "@prisma/client";

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "::1"];

/**
 * En tests la base tiene que ser local: `npm test` no debe escribir en un proyecto remoto.
 * La guarda se apoya en que `@prisma/client` carga `.env` al importarse, así que a esta
 * altura `DATABASE_URL` ya es la que se va a usar. Sin URL interpretable decide Prisma,
 * que va a fallar igual al conectar.
 */
export function assertLocalTestDatabase(rawUrl: string | undefined): void {
  let host: string;
  try {
    host = new URL(rawUrl ?? "").hostname.replace(/^\[|\]$/g, "");
  } catch {
    return;
  }

  if (host && !LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `Los tests no pueden escribir en "${host}": levantá la base local con \`supabase db start\` y corré \`npm run test:local-db\`.`
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Jest define JEST_WORKER_ID; NODE_ENV puede venir prefijado desde el entorno del shell.
if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
  assertLocalTestDatabase(process.env.DATABASE_URL);
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;