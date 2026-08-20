import { getUserRole, getUserBranchId, isAuthorizedForBranch } from './auth';

/**
 * Returns true only for the branch portal login path: `/sucursal/<digits>/login`.
 */
export function isPortalLoginPath(pathname: string): boolean {
  return /^\/sucursal\/\d+\/login$/.test(pathname);
}

/**
 * Decides whether a request to a branch-specific path should be allowed
 * @param pathname The request path
 * @returns Object with decision and redirect info if needed
 */
export async function decideBranchAccess(pathname: string): Promise<{
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}> {
  // Extract branchId from path like /sucursal/123/inventory
  const pathMatch = pathname.match(/^\/sucursal\/(\d+)/);
  if (!pathMatch) {
    // Not a branch-specific path, allow by default (will be handled by main middleware)
    return { allowed: true };
  }

  const branchId = parseInt(pathMatch[1], 10);
  if (isNaN(branchId)) {
    return { allowed: false, reason: 'Invalid branch ID' };
  }

  // Check if user is authorized for this branch
  const isAuthorized = await isAuthorizedForBranch(branchId);
  if (!isAuthorized) {
    return {
      allowed: false,
      reason: 'Unauthorized: Insufficient permissions for this branch',
    };
  }

  return { allowed: true };
}

/**
 * Gets the branch ID from a path if it's a branch-specific path
 * @param pathname The request path
 * @returns Branch ID if path is branch-specific, null otherwise
 */
export function getBranchIdFromPath(pathname: string): number | null {
  const pathMatch = pathname.match(/^\/sucursal\/(\d+)/);
  if (!pathMatch) return null;

  const branchId = parseInt(pathMatch[1], 10);
  return isNaN(branchId) ? null : branchId;
}