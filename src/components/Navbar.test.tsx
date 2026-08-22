/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import Navbar from "./Navbar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("@/actions/auth", () => ({
  getUser: jest.fn().mockResolvedValue(null),
  login: jest.fn(),
  logout: jest.fn(),
}));

import { usePathname } from "next/navigation";

describe("Navbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing on the login page", () => {
    (usePathname as jest.Mock).mockReturnValue("/login");
    const { container } = render(React.createElement(Navbar));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on the unauthorized page", () => {
    (usePathname as jest.Mock).mockReturnValue("/unauthorized");
    const { container } = render(React.createElement(Navbar));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["/forgot-password"],
    ["/reset-password"],
    ["/auth/callback"],
  ])("renders nothing on the auth route %s", (pathname) => {
    (usePathname as jest.Mock).mockReturnValue(pathname);
    const { container } = render(React.createElement(Navbar));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders brand and login link on internal pages", async () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(React.createElement(Navbar));

    expect(
      screen.getByRole("link", { name: /seguimientos compras/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /iniciar sesión/i })
    ).toBeInTheDocument();
  });
});