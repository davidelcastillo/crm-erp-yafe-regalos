// src/lib/context/BranchContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export interface BranchOption {
  id: number;
  name: string;
}

interface BranchContextValue {
  /** Currently selected branch id. null = "All Branches". */
  branchId: number | null;
  /** Currently selected branch name, or null. */
  branch: BranchOption | null;
  /** Available branches for the selector. */
  branches: BranchOption[];
  /** Whether the context has finished initializing. */
  ready: boolean;
  /** Select a branch by id, or null for "All Branches". */
  setBranchId: (id: number | null) => void;
  /** Refresh the branch list from the server. */
  refreshBranches: () => Promise<void>;
}

const ALL_BRANCHES = null as number | null;

/**
 * First path segment of a pathname, e.g. "/ventas/123" -> "ventas".
 * Used to detect when the user navigates to a different route group (page).
 */
function routeGroup(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export function BranchProvider({
  children,
  initialBranches,
}: {
  children: ReactNode;
  initialBranches: BranchOption[];
}) {
  const [branchId, setBranchIdState] = useState<number | null>(ALL_BRANCHES);
  const [branches, setBranches] = useState<BranchOption[]>(initialBranches);
  const [ready] = useState(true);
  const pathname = usePathname();
  const prevRouteGroupRef = useRef<string | null>(null);
  const lastAppliedRef = useRef<BranchOption[]>(initialBranches);
  const mountedRef = useRef(false);

  // Self-heal: re-sync when the initialBranches prop becomes non-empty after
  // mount (e.g. root layout fetched branches pre-auth, then the user logs in
  // and navigates client-side). Content-compare against the last-applied list
  // so identical re-renders are skipped and a manual refreshBranches result is
  // never clobbered by a stale prop.
  useEffect(() => {
    if (initialBranches.length === 0) return;
    if (
      JSON.stringify(lastAppliedRef.current) === JSON.stringify(initialBranches)
    ) {
      return;
    }
    setBranches(initialBranches);
    lastAppliedRef.current = initialBranches;
  }, [initialBranches]);

  // Fallback: if mounted with an empty list, fetch branch options once. The
  // mountedRef guard makes this StrictMode-safe (no duplicate fetch) and it
  // never re-fires on navigation because the deps array is empty.
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (branches.length === 0) void refreshBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the branch selection when the user navigates to a different route
  // group (product decision: the branch selector clears between pages). The
  // branch selection is deliberately NOT persisted (no localStorage).
  useEffect(() => {
    const group = routeGroup(pathname);
    if (prevRouteGroupRef.current !== null && prevRouteGroupRef.current !== group) {
      setBranchIdState(ALL_BRANCHES);
    }
    prevRouteGroupRef.current = group;
  }, [pathname]);

  const setBranchId = useCallback((id: number | null) => {
    setBranchIdState(id);
  }, []);

  const refreshBranches = useCallback(async () => {
    const { getBranchOptions } = await import("@/app/actions/branch");
    const result = await getBranchOptions();
    if (result.success && result.data) {
      setBranches(result.data as BranchOption[]);
    }
  }, []);

  const branch = branchId
    ? branches.find((b) => b.id === branchId) ?? null
    : null;

  return (
    <BranchContext.Provider
      value={{
        branchId,
        branch,
        branches,
        ready,
        setBranchId,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (ctx === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return ctx;
}

export { ALL_BRANCHES };
