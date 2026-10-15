import { prisma } from "@/lib/prisma";

async function main() {
  // Get all branches that don't have a code yet.
  // Uses raw SQL because the Prisma schema now declares `code` as required,
  // while legacy rows may still contain NULL in the database.
  const branchesWithoutCode = await prisma.$queryRaw<{ id: number; name: string }[]>`
    SELECT id, name FROM "Branch" WHERE "code" IS NULL
  `;

  console.log(`Found ${branchesWithoutCode.length} branches without code`);

  // Generate codes for each branch
  for (const branch of branchesWithoutCode) {
    // Generate code from name: take first letters of each word, uppercase, limit to 10 chars
    const code = branch.name
      .toUpperCase()
      .split(/\s+/)
      .map(word => word.charAt(0))
      .join('')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10) || `BR${branch.id.toString().padStart(3, '0')}`;

    // Check if this code already exists (shouldn't happen with our generation logic, but just in case)
    const existingBranch = await prisma.branch.findFirst({
      where: { code },
    });

    let finalCode = code;
    let counter = 1;
    while (existingBranch && existingBranch.id !== branch.id) {
      // If code already exists, append a number
      finalCode = `${code.slice(0, 8)}${counter.toString().padStart(2, '0')}`;
      counter++;
    }

    // Update the branch with the generated code
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