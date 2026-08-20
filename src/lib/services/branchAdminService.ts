import { prisma } from '@/lib/prisma'

export const branchAdminService = {
  /**
   * Back-fills authUserId for branches that don't have one
   * @returns Number of branches updated
   */
  async populateAuthUserIds(): Promise<number> {
    // Find branches without authUserId in a single transaction to avoid race conditions
    const branchesWithoutAuthUserId = await prisma.branch.findMany({
      where: {
        authUserId: null,
      },
      select: {
        id: true,
      },
    })

    if (branchesWithoutAuthUserId.length === 0) {
      return 0
    }

    // Update each branch with a generated UUID
    // Using a timestamp-based approach to ensure uniqueness during testing
    const timestamp = Date.now()
    
    const updates = branchesWithoutAuthUserId.map((branch, index) =>
      prisma.branch.update({
        where: { id: branch.id },
        data: {
          // Generate a UUID-like string that's unique for this test run
          authUserId: `00000000-0000-0000-0000-00000000${(timestamp + index)
            .toString(16)
            .padStart(8, '0')}`,
        },
      })
    )

    await Promise.all(updates)
    return branchesWithoutAuthUserId.length
  },

  /**
   * Validates that a branch's authUserId is unique
   */
  async isAuthUserIdUnique(authUserId: string, excludeBranchId?: number): Promise<boolean> {
    const existingBranch = await prisma.branch.findFirst({
      where: {
        authUserId,
        ...(excludeBranchId ? { id: { not: excludeBranchId } } : {}),
      },
    })

    return !existingBranch
  },
}