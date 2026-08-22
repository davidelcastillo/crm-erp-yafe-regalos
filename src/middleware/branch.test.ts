/**
 * Unit tests for the pure decideBranchAccess middleware decision function.
 *
 * Covers the 4 cases from the app-middleware delta spec:
 *   - GET to a well-formed /sucursal/<id>/... path      -> allow (anonymous)
 *   - GET to a well-formed /sucursal/<id>/... path      -> allow (any role)
 *   - HTTP verb is not GET                              -> deny (reason "method")
 *   - pathname does not match ^/sucursal/(\d+)          -> deny (reason "branch")
 */
import { decideBranchAccess } from "./branch";

describe("decideBranchAccess - Pure Function", () => {
  it("allows an anonymous GET request to a well-formed branch path", () => {
    expect(
      decideBranchAccess({ pathname: "/sucursal/39/inventory", method: "GET" })
    ).toEqual({ allowed: true });
  });

  it("allows a GET request regardless of session role (no role rule)", () => {
    expect(
      decideBranchAccess({ pathname: "/sucursal/5/inventory", method: "GET" })
    ).toEqual({ allowed: true });
  });

  it("denies when the HTTP verb is not GET", () => {
    expect(
      decideBranchAccess({ pathname: "/sucursal/5/inventory", method: "POST" })
    ).toEqual({ allowed: false, reason: "method" });
  });

  it("denies when the pathname does not match ^/sucursal/(\\d+)", () => {
    expect(
      decideBranchAccess({ pathname: "/sucursal/abc/inventory", method: "GET" })
    ).toEqual({ allowed: false, reason: "branch" });
  });
});