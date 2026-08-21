/**
 * Unit tests for the pure decideBranchAccess middleware decision function.
 *
 * Covers the 4 deny cases + 1 allow case from the FASE 4 tasks:
 *   - branchId in URL differs from claim  -> deny (reason "branch")
 *   - HTTP verb is not GET                -> deny (reason "method")
 *   - role is not branch_user             -> deny (reason "role")
 *   - missing branchId claim              -> deny (reason "claim")
 *   - matching role/claim/verb/branch     -> allow
 */
import { decideBranchAccess } from "./branch";

describe("decideBranchAccess - Pure Function", () => {
  const base = {
    pathname: "/sucursal/5/inventory",
    method: "GET",
    role: "branch_user",
    branchId: 5,
  };

  it("allows a GET request to the user's own branch", () => {
    expect(decideBranchAccess(base)).toEqual({ allowed: true });
  });

  it("denies when the URL branchId differs from the claim branchId", () => {
    expect(decideBranchAccess({ ...base, pathname: "/sucursal/6/inventory" })).toEqual({
      allowed: false,
      reason: "branch",
    });
  });

  it("denies when the HTTP verb is not GET", () => {
    expect(decideBranchAccess({ ...base, method: "POST" })).toEqual({
      allowed: false,
      reason: "method",
    });
  });

  it("denies when the role is not branch_user", () => {
    expect(decideBranchAccess({ ...base, role: "admin" })).toEqual({
      allowed: false,
      reason: "role",
    });
  });

  it("denies when the branchId claim is missing", () => {
    expect(decideBranchAccess({ ...base, branchId: undefined })).toEqual({
      allowed: false,
      reason: "claim",
    });
  });
});
