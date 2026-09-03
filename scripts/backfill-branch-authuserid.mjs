// scripts/backfill-branch-authuserid.mjs
// One-off idempotent backfill (no DDL): sets authUserId = NULL on Branch rows
// whose authUserId is present but not a well-formed UUID v4 (legacy placeholder
// values that would make deleteBranch fail with "Expected parameter to be UUID").
// Safe to re-run: a second run finds nothing to update.
//
// Usage:
//   node scripts/backfill-branch-authuserid.mjs
//
// Env (dotenv/config, same style as scripts/backfill-admin-claim.mjs):
//   DATABASE_URL                     (required — used by the Prisma client)
//   NEXT_PUBLIC_SUPABASE_URL         (optional — loaded for parity; not needed here)
//   SUPABASE_SERVICE_ROLE_KEY        (optional — loaded for parity; not needed here)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Mirrors UUID_V4_REGEX in src/lib/utils/supabaseAuth.ts (cannot be imported
// from a plain .mjs run by node, so it is replicated here deliberately).
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (value) => typeof value === "string" && UUID_V4_REGEX.test(value);

const BATCH_SIZE = 100;

if (!process.env.DATABASE_URL) {
  console.error(
    "Missing required env var: DATABASE_URL must be set in .env (used by the Prisma client)."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Prisma does not support regex in updateMany where, so load the candidate
  // rows first and filter in JS.
  const rows = await prisma.branch.findMany({
    where: { authUserId: { not: null } },
    select: { id: true, authUserId: true },
  });

  const toNullify = rows.filter((row) => !isValidUuid(row.authUserId));

  if (toNullify.length === 0) {
    console.log("No branches with invalid/placeholder authUserId found. Nothing to do.");
    return;
  }

  for (let i = 0; i < toNullify.length; i += BATCH_SIZE) {
    const batch = toNullify.slice(i, i + BATCH_SIZE);
    await prisma.branch.updateMany({
      where: { id: { in: batch.map((row) => row.id) } },
      data: { authUserId: null },
    });
  }

  console.log(
    `Backfill complete: set authUserId = NULL on ${toNullify.length} branch(es).`
  );
  for (const row of toNullify) {
    console.log(`  id=${row.id}  authUserId=${row.authUserId}`);
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
