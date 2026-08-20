// src/lib/context/BranchProviderWrapper.tsx
"use client";

import { ReactNode } from "react";
import { BranchProvider } from "./BranchContext";

/**
 * Client wrapper around BranchProvider.
 * Receives the initial branch list (fetched server-side) and hydrates the
 * BranchContext on the client, so every page under the layout gets branch context
 * without an extra round trip.
 */
export function BranchProviderWrapper({
  children,
  initialBranches,
}: {
  children: ReactNode;
  initialBranches: { id: number; name: string }[];
}) {
  return (
    <BranchProvider initialBranches={initialBranches}>
      {children}
    </BranchProvider>
  );
}
