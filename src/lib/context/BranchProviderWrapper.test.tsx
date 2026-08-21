/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { BranchProviderWrapper } from "./BranchProviderWrapper";
import { useBranch, type BranchOption } from "./BranchContext";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));
import { usePathname } from "next/navigation";

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(),
}));
import { getBranchOptions } from "@/app/actions/branch";

const INITIAL_BRANCHES: BranchOption[] = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

function Probe() {
  const { branches } = useBranch();
  return <span data-testid="branch-count">{branches.length}</span>;
}

describe("BranchProviderWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    (getBranchOptions as jest.Mock).mockResolvedValue({
      success: true,
      data: INITIAL_BRANCHES,
    });
  });

  it("skips branch loading entirely on /login", async () => {
    (usePathname as jest.Mock).mockReturnValue("/login");
    render(
      <BranchProviderWrapper>
        <div>login content</div>
      </BranchProviderWrapper>
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getBranchOptions).not.toHaveBeenCalled();
  });

  it("skips branch loading entirely on /unauthorized", async () => {
    (usePathname as jest.Mock).mockReturnValue("/unauthorized");
    render(
      <BranchProviderWrapper>
        <div>unauthorized content</div>
      </BranchProviderWrapper>
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getBranchOptions).not.toHaveBeenCalled();
  });

  it("hydrates branches client-side on internal pages", async () => {
    render(
      <BranchProviderWrapper>
        <Probe />
      </BranchProviderWrapper>
    );

    await waitFor(() => {
      expect(getBranchOptions).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("branch-count")).toHaveTextContent("2");
    });
  });

  it("accepts initialBranches and does not refetch when non-empty", async () => {
    render(
      <BranchProviderWrapper initialBranches={INITIAL_BRANCHES}>
        <Probe />
      </BranchProviderWrapper>
    );

    expect(screen.getByTestId("branch-count")).toHaveTextContent("2");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getBranchOptions).not.toHaveBeenCalled();
  });
});