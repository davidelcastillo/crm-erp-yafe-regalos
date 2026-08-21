import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Ensure default branch exists
  let branch = await prisma.branch.findFirst({
    where: { name: 'Depósito' },
  })
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Depósito',
        address: 'Dirección principal',
        phone: '123-456-7890',
        email: 'deposito@feriaconexx.com',
        code: 'DEP',
        isActive: true,
        // In a real scenario, this would be the actual Supabase Auth user ID
        // For development, we'll use a placeholder UUID
        authUserId: '00000000-0000-0000-0000-000000000001',
      },
    })
  } else {
    // Update existing branch to have authUserId if it doesn't have one
    if (!branch.authUserId) {
      branch = await prisma.branch.update({
        where: { id: branch.id },
        data: {
          authUserId: '00000000-0000-0000-0000-000000000001',
        },
      })
    }
  }

  // Ensure default category exists
  let category = await prisma.category.findFirst({
    where: { name: 'General' },
  })
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'General',
      },
    })
  }

  console.log({ branch, category })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })