/**
 * Unit tests for BranchContext reset-on-navigation behavior (FIX-FASE4 4.1)
 *
 * Covers:
 *   - branchId resets to null when navigating to a different route group
 *   - branchId is kept when navigating within the same route group
 *   - no localStorage reads/writes (persistence removed)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fix-fase4-correcciones/specs/branch-management/spec.md
 */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { BranchProvider, useBranch, BranchOption } from "./BranchContext";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));
import { usePathname } from "next/navigation";

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(),
}));
import { getBranchOptions } from "@/app/actions/branch";

const INITIAL_BRANCHES = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

function wrapper({ children }: { children: React.ReactNode }) {
  return <BranchProvider initialBranches={INITIAL_BRANCHES}>{children}</BranchProvider>;
}

describe("BranchContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("exposes the provider API and starts with branchId null", () => {
    const { result } = renderHook(() => useBranch(), { wrapper });

    expect(result.current.branchId).toBeNull();
    expect(result.current.branch).toBeNull();
    expect(result.current.branches).toHaveLength(2);
    expect(result.current.ready).toBe(true);
    expect(typeof result.current.setBranchId).toBe("function");
    expect(typeof result.current.refreshBranches).toBe("function");
  });

  it("resets branchId to null when navigating to a different route group", () => {
    const { result, rerender } = renderHook(() => useBranch(), { wrapper });

    act(() => {
      result.current.setBranchId(2);
    });
    expect(result.current.branchId).toBe(2);

    // Navigate from /dashboard to /ventas (different route group)
    act(() => {
      (usePathname as jest.Mock).mockReturnValue("/ventas");
      rerender();
    });

    expect(result.current.branchId).toBeNull();
  });

  it("keeps branchId when navigating within the same route group", () => {
    (usePathname as jest.Mock).mockReturnValue("/ventas");
    const { result, rerender } = renderHook(() => useBranch(), { wrapper });

    act(() => {
      result.current.setBranchId(1);
    });
    expect(result.current.branchId).toBe(1);

    // e.g. /ventas -> /ventas/123 (same route group)
    act(() => {
      (usePathname as jest.Mock).mockReturnValue("/ventas/123");
      rerender();
    });

    expect(result.current.branchId).toBe(1);
  });

  it("never reads or writes to localStorage", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem");
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    const removeItem = jest.spyOn(Storage.prototype, "removeItem");

    const { result, rerender } = renderHook(() => useBranch(), { wrapper });

    act(() => {
      result.current.setBranchId(2);
    });
    act(() => {
      (usePathname as jest.Mock).mockReturnValue("/compras");
      rerender();
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});

describe("BranchContext self-heal (mejoras-f3-f4 item 1)", () => {
  let currentInitialBranches: BranchOption[];

  function propWrapper({ children }: { children: React.ReactNode }) {
    return (
      <BranchProvider initialBranches={currentInitialBranches}>{children}</BranchProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    (getBranchOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
    currentInitialBranches = [];
  });

  it("re-syncs branches when initialBranches changes from empty to non-empty (hydration after login)", async () => {
    const { result, rerender } = renderHook(() => useBranch(), {
      wrapper: propWrapper,
    });

    expect(result.current.branches).toEqual([]);

    currentInitialBranches = INITIAL_BRANCHES;
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.branches).toEqual(INITIAL_BRANCHES);
    });
  });

  it("fetches branch options exactly once when initialBranches is empty after mount", async () => {
    (getBranchOptions as jest.Mock).mockResolvedValue({
      success: true,
      data: INITIAL_BRANCHES,
    });

    const { result } = renderHook(() => useBranch(), {
      wrapper: propWrapper,
    });

    await waitFor(() => {
      expect(result.current.branches).toEqual(INITIAL_BRANCHES);
    });

    expect(getBranchOptions).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch getBranchOptions when navigating between route groups", async () => {
    (getBranchOptions as jest.Mock).mockResolvedValue({
      success: true,
      data: INITIAL_BRANCHES,
    });

    const { result, rerender } = renderHook(() => useBranch(), {
      wrapper: propWrapper,
    });

    await waitFor(() => {
      expect(result.current.branches).toEqual(INITIAL_BRANCHES);
    });
    expect(getBranchOptions).toHaveBeenCalledTimes(1);

    act(() => {
      (usePathname as jest.Mock).mockReturnValue("/ventas");
      rerender();
    });

    expect(getBranchOptions).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a manual refreshBranches result with a stale prop", async () => {
    (getBranchOptions as jest.Mock).mockResolvedValue({
      success: true,
      data: INITIAL_BRANCHES,
    });
    currentInitialBranches = INITIAL_BRANCHES;

    const refreshed: BranchOption[] = [
      { id: 1, name: "Principal" },
      { id: 2, name: "Centro" },
      { id: 3, name: "Nueva Sucursal" },
    ];

    const { result, rerender } = renderHook(() => useBranch(), {
      wrapper: propWrapper,
    });

    act(() => {
      (getBranchOptions as jest.Mock).mockResolvedValue({
        success: true,
        data: refreshed,
      });
      void result.current.refreshBranches();
    });

    await waitFor(() => {
      expect(result.current.branches).toEqual(refreshed);
    });

    currentInitialBranches = INITIAL_BRANCHES;
    act(() => {
      rerender();
    });

    expect(result.current.branches).toEqual(refreshed);
  });
});
