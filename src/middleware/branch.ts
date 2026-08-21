/**
 * Pure decision logic for the external branch portal (/sucursal/*).
 *
 * Deliberately free of next/server imports and DB access so it can be unit
 * tested in isolation. See spec: openspec/changes/fase4-ui-portal-export/
 * specs/branch-external-portal/spec.md (Branch Middleware Guard).
 */
export type BranchAccessInput = {
  pathname: string;
  method: string;
  role: string | null | undefined;
  branchId: string | number | null | undefined;
};

export type BranchAccessDecision = {
  allowed: boolean;
  reason?: string;
};

/**
 * Decides whether a request to /sucursal/<branchId>/... should be allowed.
 *
 * Rules (checked in order):
 *   1. role must be `branch_user`            -> deny with reason "role"
 *   2. the branchId claim must exist         -> deny with reason "claim"
 *   3. the HTTP method must be GET           -> deny with reason "method"
 *   4. the URL branchId must match the claim -> deny with reason "branch"
 *   5. otherwise -> allow
 */
export function decideBranchAccess(input: BranchAccessInput): BranchAccessDecision {
  const { pathname, method, role, branchId } = input;

  if (role !== 'branch_user') {
    return { allowed: false, reason: 'role' };
  }

  if (branchId === null || branchId === undefined) {
    return { allowed: false, reason: 'claim' };
  }

  if (method !== 'GET') {
    return { allowed: false, reason: 'method' };
  }

  const pathMatch = pathname.match(/^\/sucursal\/(\d+)/);
  if (!pathMatch) {
    return { allowed: false, reason: 'branch' };
  }

  const urlBranchId = Number(pathMatch[1]);
  const claimBranchId = Number(branchId);

  if (Number.isNaN(urlBranchId) || Number.isNaN(claimBranchId) || urlBranchId !== claimBranchId) {
    return { allowed: false, reason: 'branch' };
  }

  return { allowed: true };
}
