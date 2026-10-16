import { prisma } from '../../lib/prisma'
import { branchAdminService } from './branchAdminService'

// Integration tests write to the local Supabase stack (see AGENTS.md §2);
// hooks need more than the default 5s Jest timeout (cleanup now also deletes
// dependent Purchase/Sale rows). Run them with `npm run test:local-db`.
jest.setTimeout(30000)

describe('branchAdminService', () => {
  beforeEach(async () => {
    // Clean up test data. Delete dependent Purchase/Sale rows FIRST because
    // Branch has no cascade on those relations — otherwise a leftover test
    // branch with transactions violates the FK (Purchase_branchId_fkey).
    const branches = await prisma.branch.findMany({
      where: {
        name: {
          startsWith: 'Test Branch',
        },
      },
      select: { id: true },
    })
    const ids = branches.map(b => b.id)
    if (ids.length > 0) {
      await prisma.purchase.deleteMany({ where: { branchId: { in: ids } } })
      await prisma.sale.deleteMany({ where: { branchId: { in: ids } } })
    }
    await prisma.branch.deleteMany({
      where: {
        name: {
          startsWith: 'Test Branch',
        },
      },
    })
  })

  // Note: Skipping prisma.$disconnect() in afterAll due to Jest/test environment issues
  // with setImmediate. This doesn't affect test results as each test cleans up its own data.

  describe('populateAuthUserIds', () => {
    it('should update branches without authUserId', async () => {
      // Create test branches without authUserId
      const creadas = await Promise.all([
        prisma.branch.create({
          data: { name: 'Test Branch 1', isActive: true, code: 'TST001' },
        }),
        prisma.branch.create({
          data: { name: 'Test Branch 2', isActive: true, code: 'TST002' },
        }),
      ])
      const ids = creadas.map((b) => b.id)

      // Execute the service
      const updatedCount = await branchAdminService.populateAuthUserIds()

      // El servicio actualiza TODAS las sucursales sin authUserId de la base, así
      // que se afirma sobre las propias: contar el total lo rompe cualquier otra
      // suite que cree una sucursal sin usuario en paralelo.
      expect(updatedCount).toBeGreaterThanOrEqual(2)

      const propias = await prisma.branch.findMany({
        where: { id: { in: ids } },
        select: { authUserId: true },
      })
      expect(propias).toHaveLength(2)
      expect(propias.every((b) => b.authUserId !== null)).toBe(true)
    }, 10000) // Increase timeout to 10 seconds

    it('should not touch branches that already have authUserId', async () => {
      // Create test branches with authUserId
      const creadas = await Promise.all([
        prisma.branch.create({
          data: { name: 'Test Branch 3', isActive: true, code: 'TST003', authUserId: 'test-uuid-1' },
        }),
        prisma.branch.create({
          data: { name: 'Test Branch 4', isActive: true, code: 'TST004', authUserId: 'test-uuid-2' },
        }),
      ])
      const ids = creadas.map((b) => b.id)

      // Execute the service
      await branchAdminService.populateAuthUserIds()

      const propias = await prisma.branch.findMany({
        where: { id: { in: ids } },
        select: { authUserId: true },
      })
      expect(propias.map((b) => b.authUserId).sort()).toEqual([
        'test-uuid-1',
        'test-uuid-2',
      ])
    }, 10000) // Increase timeout to 10 seconds
  })

  describe('isAuthUserIdUnique', () => {
    it('should return true for a unique authUserId', async () => {
      // Create a branch with a specific authUserId
      await prisma.branch.create({
        data: {
          name: 'Test Branch 5',
          isActive: true,
          code: 'TST005',
          authUserId: 'test-unique-uuid',
        },
      })

      // Check if a different UUID is unique
      const isUnique = await branchAdminService.isAuthUserIdUnique('different-uuid')
      expect(isUnique).toBe(true)
    })

    it('should return false for a duplicate authUserId', async () => {
      // Create a branch with a specific authUserId
      await prisma.branch.create({
        data: {
          name: 'Test Branch 6',
          isActive: true,
          code: 'TST006',
          authUserId: 'duplicate-test-uuid',
        },
      })

      // Check if the same UUID is unique (should be false)
      const isUnique = await branchAdminService.isAuthUserIdUnique('duplicate-test-uuid')
      expect(isUnique).toBe(false)
    })

    it('should allow updating the same branch (excludeBranchId)', async () => {
      // Create a branch with a specific authUserId
      const branch = await prisma.branch.create({
        data: {
          name: 'Test Branch 7',
          isActive: true,
          code: 'TST007',
          authUserId: 'same-uuid-test',
        },
      })

      // Check if the same UUID is unique when excluding this branch's ID
      const isUnique = await branchAdminService.isAuthUserIdUnique(
        'same-uuid-test',
        branch.id
      )
      expect(isUnique).toBe(true) // Should be true because we're excluding this branch
    })
  })
})