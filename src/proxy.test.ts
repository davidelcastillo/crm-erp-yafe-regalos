/**
 * Unit tests for the proxy middleware (src/proxy.ts).
 *
 * Regression tests for the redirect-loop fix: /unauthorized must be treated
 * as an excluded (renderable) route so an authenticated non-admin user is not
 * redirected to /unauthorized over and over again, and an unauthenticated
 * user visiting /unauthorized is not bounced to /login.
 *
 * @jest-environment node
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({ set: jest.fn(), get: jest.fn() }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createServerClient: jest.fn(),
}));

jest.mock("@/lib/supabase/auth", () => ({
  getUserRole: jest.fn(),
  getUserBranchId: jest.fn(),
}));

jest.mock("@/lib/supabase/branch", () => ({
  isPortalLoginPath: jest.requireActual("@/lib/supabase/branch")
    .isPortalLoginPath,
}));

import { createServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";

const nextSpy = jest
  .spyOn(NextResponse, "next")
  .mockReturnValue({ __mock: "next-response" } as unknown as NextResponse);
const redirectSpy = jest.spyOn(NextResponse, "redirect");

function mockRequest(pathname: string, method = "GET"): NextRequest {
  return {
    nextUrl: { pathname, search: "" },
    url: `https://app.example.com${pathname}`,
    method,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function mockUser(user: { id: string } | null) {
  (createServerClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  });
}

describe("proxy middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUserRole as jest.Mock).mockResolvedValue("admin");
  });

  it("lets an unauthenticated user reach /unauthorized (no /login redirect loop)", async () => {
    mockUser(null);
    const response = await proxy(mockRequest("/unauthorized"));

    expect(redirectSpy).not.toHaveBeenCalled();
    expect(response).toEqual({ __mock: "next-response" });
  });

  it("renders /unauthorized for an authenticated non-admin (no self-redirect loop)", async () => {
    mockUser({ id: "user-1" });
    (getUserRole as jest.Mock).mockResolvedValue("staff");

    const response = await proxy(mockRequest("/unauthorized"));

    expect(redirectSpy).not.toHaveBeenCalled();
    expect(response).toEqual({ __mock: "next-response" });
  });

  it("still redirects an authenticated non-admin away from internal routes", async () => {
    mockUser({ id: "user-1" });
    (getUserRole as jest.Mock).mockResolvedValue("staff");

    await proxy(mockRequest("/dashboard"));

    expect(redirectSpy).toHaveBeenCalledTimes(1);
    const redirectTarget = redirectSpy.mock.calls[0][0] as URL;
    expect(new URL(redirectTarget).pathname).toBe("/unauthorized");
  });

  it("still lets an unauthenticated user reach /login", async () => {
    mockUser(null);

    const response = await proxy(mockRequest("/login"));

    expect(redirectSpy).not.toHaveBeenCalled();
    expect(response).toEqual({ __mock: "next-response" });
  });
});