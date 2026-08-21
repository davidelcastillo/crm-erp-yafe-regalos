// src/lib/context/BranchProviderWrapper.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BranchProvider, BranchOption } from "./BranchContext";

/**
 * Auth-only routes that must render WITHOUT any branch loading or provider
 * wiring: the login page and the unauthorized error page. On these routes the
 * BranchProvider is skipped entirely, so no Supabase/Prisma work happens at
 * all (the root layout no longer fetches branches server-side, which used to
 * block every render — including /login — on createServerClient + getUser +
 * a Prisma query).
 *
 * On every other route the provider is rendered and hydrates branches
 * client-side through BranchProvider's self-heal fallback (it fetches once
 * when mounted with an empty list), preserving the useBranch() contract for
 * all internal pages (dashboard, compras, ventas, BranchSelector, etc.).
 */
const AUTH_ROUTES = new Set(["/login", "/unauthorized"]);

export function BranchProviderWrapper({
  children,
  initialBranches = [],
}: {
  children: ReactNode;
  initialBranches?: BranchOption[];
}) {
  const pathname = usePathname();

  if (AUTH_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <BranchProvider initialBranches={initialBranches}>
      {children}
    </BranchProvider>
  );
}