import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Gets the current user's role from Supabase auth metadata
 * @returns User role ('admin', 'branch_user', or null if not authenticated)
 */
export async function getUserRole(): Promise<'admin' | 'branch_user' | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Role is stored in app_metadata
    const role = user.app_metadata?.role as 'admin' | 'branch_user' | undefined;
    return role ?? null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Gets the current user's branchId from Supabase auth metadata
 * @returns Branch ID if user is a branch_user, null otherwise
 */
export async function getUserBranchId(): Promise<number | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Branch ID is stored in app_metadata for branch users
    const branchId = user.app_metadata?.branchId;
    return typeof branchId === 'number' ? branchId : null;
  } catch (error) {
    console.error('Error getting user branch ID:', error);
    return null;
  }
}

/**
 * Checks if the current user has the specified role
 * @param role Role to check for
 * @returns True if user has the role, false otherwise
 */
export async function hasUserRole(role: 'admin' | 'branch_user'): Promise<boolean> {
  const userRole = await getUserRole();
  return userRole === role;
}

/**
 * Checks if the current user is authorized to access the specified branch
 * @param branchId Branch ID to check access for
 * @returns True if user is authorized, false otherwise
 */
export async function isAuthorizedForBranch(branchId: number): Promise<boolean> {
  try {
    // Admin users can access any branch
    const isAdmin = await hasUserRole('admin');
    if (isAdmin) return true;

    // Branch users can only access their own branch
    const userBranchId = await getUserBranchId();
    return userBranchId === branchId;
  } catch (error) {
    console.error('Error checking branch authorization:', error);
    return false;
  }
}