import { isPortalLoginPath } from "./branch";

describe("isPortalLoginPath", () => {
  it("returns true only for /sucursal/<digits>/login", () => {
    expect(isPortalLoginPath("/sucursal/210/login")).toBe(true);
  });

  it("returns false for other branch paths", () => {
    expect(isPortalLoginPath("/sucursal/210/inventory")).toBe(false);
    expect(isPortalLoginPath("/sucursal/210/")).toBe(false);
  });

  it("returns false for non-digit or malformed branch ids", () => {
    expect(isPortalLoginPath("/sucursal/abc/login")).toBe(false);
    expect(isPortalLoginPath("/sucursal/210/login/extra")).toBe(false);
  });

  it("returns false for unrelated paths", () => {
    expect(isPortalLoginPath("/login")).toBe(false);
    expect(isPortalLoginPath("/sucursal/210")).toBe(false);
  });
});
