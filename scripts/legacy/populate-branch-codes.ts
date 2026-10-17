import { prisma } from "@/lib/prisma";
import { baseBranchCode, freeBranchCode } from "./branch-code";

async function main() {
  // Get all branches that don't have a code yet.
  // Uses raw SQL because the Prisma schema now declares `code` as required,
  // while legacy rows may still contain NULL in the database.
  const branchesWithoutCode = await prisma.$queryRaw<{ id: number; name: string }[]>`
    SELECT id, name FROM "Branch" WHERE "code" IS NULL
  `;

  console.log(`Found ${branchesWithoutCode.length} branches without code`);

  // Los códigos ya usados se leen una sola vez y se amplían en memoria: así el
  // bucle termina y dos sucursales no pueden recibir el mismo código.
  const assigned = await prisma.$queryRaw<{ code: string }[]>`
    SELECT "code" FROM "Branch" WHERE "code" IS NOT NULL
  `;
  const taken = new Set(assigned.map((row) => row.code));

  for (const branch of branchesWithoutCode) {
    const finalCode = freeBranchCode(baseBranchCode(branch.name, branch.id), taken);
    taken.add(finalCode);

    await prisma.branch.update({
      where: { id: branch.id },
      data: {
        code: finalCode,
      },
    });

    console.log(`Updated branch "${branch.name}" (ID: ${branch.id}) with code: ${finalCode}`);
  }

  console.log("Branch code population completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
