// src/app/actions/branch.ts
"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient, createServerClient } from "@/lib/supabase/server";
import { hasUserRole } from "@/lib/supabase/auth";
import {
  createBranchUser,
  deleteBranchUser,
  generateBranchEmail,
  generateTemporaryPassword,
  isValidUuid,
} from "@/lib/utils/supabaseAuth";
import {
  createBranchSchema,
  updateBranchSchema,
  deleteBranchSchema,
} from "@/lib/validations/branch";

export async function createBranch(data: unknown) {
  try {
    const validatedData = createBranchSchema.parse(data);

    // Duplicate-code check
    const existingBranch = await prisma.branch.findFirst({
      where: { code: validatedData.code },
    });
    if (existingBranch) {
      return { success: false, error: "DUPLICATE_CODE" };
    }

    // Start a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the branch record first (without authUserId)
      const branch = await tx.branch.create({
        data: {
          name: validatedData.name,
          address: validatedData.address || null,
          phone: validatedData.phone || null,
          email: validatedData.email || null,
          code: validatedData.code,
          isActive: validatedData.isActive,
        },
      });

      // 2. Provision a Supabase Auth user for this branch with one-time
      //    temporary credentials (never persisted in the application DB)
      const email = generateBranchEmail(branch.code!);
      const password = generateTemporaryPassword();

      const serviceClient = createServiceClient();
      const authResult = await createBranchUser(serviceClient, {
        email,
        password,
        name: validatedData.name,
        branchId: branch.id,
      });

      // Throw so the transaction rolls back the Branch insert — no partial
      // persistence is left behind.
      if (authResult.error) {
        throw new Error(`Failed to create auth user: ${authResult.error}`);
      }

      // 3. Update the branch with the authUserId
      const updatedBranch = await tx.branch.update({
        where: { id: branch.id },
        data: {
          authUserId: authResult.id,
        },
      });

      return {
        branch: updatedBranch,
        credentials: { email, password },
      };
    });

    revalidatePath("/sucursales");
    return {
      success: true,
      data: {
        branch: parseObject(result.branch),
        credentials: result.credentials,
      },
    };
   } catch (error) {
     if (error instanceof z.ZodError) {
       return {
         success: false,
         error: error.issues.map((e) => e.message).join(", "),
       };
     }
     console.error("Error creating branch:", error);
     return { success: false, error: "Error al crear la sucursal" };
   }
}

export async function getBranches() {
  // Check if the current user is an admin
  const isAdmin = await hasUserRole('admin');
  if (!isAdmin) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: parseArray(branches) };
  } catch (error) {
    console.error("Error fetching branches:", error);
    return { success: false, error: "Error al obtener las sucursales" };
  }
}

export async function getBranchById(id: number) {
  // Check if the current user is an admin
  const isAdmin = await hasUserRole('admin');
  if (!isAdmin) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      return { success: false, error: "Sucursal no encontrada" };
    }

    return { success: true, data: parseObject(branch) };
  } catch (error) {
    console.error("Error fetching branch:", error);
    return { success: false, error: "Error al obtener la sucursal" };
  }
}

export async function updateBranch(data: unknown) {
  // Check if the current user is an admin
  const isAdmin = await hasUserRole('admin');
  if (!isAdmin) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const validatedData = updateBranchSchema.parse(data);

    const branch = await prisma.branch.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.address !== undefined && {
          address: validatedData.address,
        }),
        ...(validatedData.phone !== undefined && {
          phone: validatedData.phone,
        }),
        ...(validatedData.email !== undefined && { email: validatedData.email }),
        ...(validatedData.isActive !== undefined && {
          isActive: validatedData.isActive,
        }),
        // Note: authUserId is not updated here as it should remain tied to the
        // original Supabase Auth user. Changing authUserId would require
        // creating a new Supabase user and migrating data, which is a separate
        // administrative operation.
      },
    });

    revalidatePath("/sucursales");
    revalidatePath(`/sucursales/${validatedData.id}`);
    return { success: true, data: parseObject(branch) };
   } catch (error) {
     if (error instanceof z.ZodError) {
       return {
         success: false,
         error: error.issues.map((e) => e.message).join(", "),
       };
     }
     console.error("Error updating branch:", error);
     return { success: false, error: "Error al actualizar la sucursal" };
   }
}

export async function deleteBranch(data: unknown) {
  // Check if the current user is an admin
  const isAdmin = await hasUserRole('admin');
  if (!isAdmin) {
    return { success: false, error: "No autorizado" };
  }

  try {
    const validatedData = deleteBranchSchema.parse(data);

    // Start a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the branch to find its authUserId before deletion
      const branch = await tx.branch.findUnique({
        where: { id: validatedData.id },
        select: { authUserId: true },
      });

      // 2. Prevent deletion of the default branch (id=1, "Principal")
      if (validatedData.id === 1) {
        return {
          success: false,
          error: "DEFAULT_BRANCH",
        };
      }

      // 3. Check for associated transactions before deletion
      const [purchaseCount, saleCount] = await Promise.all([
        tx.purchase.count({ where: { branchId: validatedData.id } }),
        tx.sale.count({ where: { branchId: validatedData.id } }),
      ]);

      if (purchaseCount > 0 || saleCount > 0) {
        return {
          success: false,
          error: "HAS_DEPENDENT_DATA",
        };
      }

      // 4. Check for stock in BranchInventory
      const stockCount = await tx.branchInventory.count({
        where: {
          branchId: validatedData.id,
          stock: { gt: 0 },
        },
      });

      if (stockCount > 0) {
        return {
          success: false,
          error: "HAS_STOCK",
        };
      }

      // 5. Delete the associated Supabase Auth user first. A non-UUID
      //    placeholder authUserId (legacy data) is skipped with a warning:
      //    there is no Auth user to delete, so it must not abort the branch
      //    deletion. A "User not found" failure is also non-fatal — the Auth
      //    user is already gone. Only genuine errors abort the deletion.
      if (branch?.authUserId) {
        if (!isValidUuid(branch.authUserId)) {
          console.warn(
            `deleteBranch: skipping Auth user deletion for branch ${validatedData.id}: authUserId "${branch.authUserId}" is not a valid UUID`
          );
        } else {
          const serviceClient = createServiceClient();
          const authResult = await deleteBranchUser(serviceClient, branch.authUserId);

          if (authResult.error) {
            if (/user not found/i.test(authResult.error)) {
              console.warn(
                `deleteBranch: Auth user ${branch.authUserId} not found for branch ${validatedData.id}; continuing with branch deletion`
              );
            } else {
              throw new Error(`Failed to delete auth user: ${authResult.error}`);
            }
          }
        }
      }

      // 6. Delete the branch record
      await tx.branch.delete({
        where: { id: validatedData.id },
      });

      return { success: true };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/sucursales");
    return result;
   } catch (error) {
     if (error instanceof z.ZodError) {
       return {
         success: false,
         error: error.issues.map((e) => e.message).join(", "),
       };
     }
     console.error("Error deleting branch:", error);
     return { success: false, error: "Error al eliminar la sucursal" };
   }
}

/**
 * Get lightweight branch list for dropdown selectors.
 * Returns only id and name for active branches.
 */
export async function getBranchOptions() {
  // Check if the user is authenticated
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated, return empty array (or could return error)
  if (!user) {
    return { success: true, data: [] };
  }

  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: branches };
  } catch (error) {
    console.error("Error fetching branch options:", error);
    return { success: false, error: "Error al obtener las sucursales" };
  }
}
