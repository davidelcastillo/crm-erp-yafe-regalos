/**
 * Pure decision logic for the external branch portal (/sucursal/*).
 *
 * Deliberately free of next/server imports and DB access so it can be unit
 * tested in isolation. See spec: openspec/specs/app-middleware/spec.md
 * (Capability app-middleware, delta).
 */
export type BranchAccessInput = {
  pathname: string;
  method: string;
};

export type BranchAccessDecision = {
  allowed: boolean;
  reason?: 'method' | 'branch';
};

/**
 * Decides whether a request to /sucursal/<branchId>/... should be allowed.
 *
 * /sucursal/* is public for GET requests (any role, or no session): the real
 * visibility check (Branch.isPublic / isActive) lives in the catalog action,
 * not here. Rules (checked in order):
 *   1. the HTTP method must be GET            -> deny with reason "method"
 *   2. the pathname must match ^/sucursal/(\d+) -> deny with reason "branch"
 *   3. otherwise -> allow
 */
export function decideBranchAccess(input: BranchAccessInput): BranchAccessDecision {
  const { pathname, method } = input;

  if (method !== 'GET') {
    return { allowed: false, reason: 'method' };
  }

  const pathMatch = pathname.match(/^\/sucursal\/(\d+)/);
  if (!pathMatch) {
    return { allowed: false, reason: 'branch' };
  }

  return { allowed: true };
}