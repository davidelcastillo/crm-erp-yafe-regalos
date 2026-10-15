# Design: Fase 4 Corrections (15 bugs)

## Technical Approach

Fifteen fixes in three chained PRs (A: inventario/productos; B: compras; C: sucursales/portal), no schema changes, all localized: active-only defaults, hoisted categories (N+1), client stock sums, shared reloadKey, bounded retry + first-failure log, non-fatal UUID-guarded delete + backfill, portal login with scoped proxy exclusion. Maps 1:1 to proposal + delta specs.

## Architecture Decisions

| # | Decision | Choice (alternative — why not) |
|---|----------|-------------------------------|
| 1 | reloadKey | Shared hook `useReloadKey` → `[key, bump]`; pages append `key` to load deps; buttons call `router.refresh()` then `onSuccess={bump}` (refresh alone is insufficient). Per-page inline — duplication |
| 2 | Proxy scope | Only `/sucursal/\d+/login` via pure `isPortalLoginPath()` in `src/lib/supabase/branch.ts`; `proxy.ts` adds it to `isExcluded` and skips the branch guard for it (all `/sucursal/*` exposes data). Inventory stays GET-only + `branch_user` |
| 3 | loginBranch | New `src/actions/auth.branch.ts`: signIn → require `role==='branch_user'` AND `app_metadata.branchId===URL branchId` → redirect `/sucursal/{id}/inventory`; mismatch → error, no redirect. Claim shape confirmed (`createBranchUser` sets `app_metadata {role, branchId}`) |
| 4 | BranchContext | `usePathname()` effect resets `branchId` to null; remove localStorage + `preferredBranch` (only user). Consumers OK: selector→"Todas"; AddSaleButton forces branch; AddPurchaseButton uses branches only |
| 5 | deleteBranch | Export `UUID_V4_REGEX`/`isValidUuid`; branch.ts: invalid → warn+skip; "not found" → warn+continue; else throw. Backfill `scripts/backfill-branch-authuserid.mjs`: idempotent, no DDL, non-UUID → NULL |
| 6 | N+1 | Hoist page `categories` → List → Card; remove Card mount fetch (page fetches once: 88-97). Lazy/module cache — stale names |
| 7 | "Todas" sum | Client `sumStock()` in `src/lib/inventory-stock.ts` used by both readers. Server returns all rows when branchId null, one when filtered. Server aggregate — query churn |
| 8 | active default | `getProducts`: add `active:true`; `getProductsWithBranchStock`: active unless `activeOnly===false`. `getInactiveProducts` untouched. Client filter — leaks to pickers |
| 9 | Retry | Extract `executePurchase()`; ≤3 attempts only for Prisma transient codes P1001/P1008/P2024/P2034; log raw error + validated input on first failure. Validation returns pre-transaction → never retried |
| 10 | Hardening | AddPurchaseButton: functional `setItems`; ref-counter ids; `performedBy` via `getUser()`; single-flight guard; call `onSuccess` |

## Work Units

**A — inventario/productos (1,2,4,6,7,8,9-11)**: actions `product.ts`/`inventory.ts` (D8); `inventario/page.tsx` (categories prop + "Inactivos" button — secondary style, min-h-[44px]); `BottomNav.tsx` (remove entry); `InventarioList`/`InventarioCard` (D6/7); `useReloadKey` + `ventas/page.tsx` + `AddSaleButton` (D1). Re-test export/move/edit (9-11).

**B — compras (3)**: `purchase.ts` (D9); `AddPurchaseButton.tsx` (D10); `compras/page.tsx`.

**C — sucursales/portal (5,12,13,14,15)**: `BranchContext.tsx` (D4); `supabaseAuth`/`branch.ts` + backfill (D5); `BranchManager.tsx` Portal button; `proxy.ts` (D2); `auth.ts` role redirect + `auth.branch.ts` + portal login page/form (D3); `await params` + grep siblings (D15).

## File Changes

| File | Action |
|------|--------|
| `src/lib/hooks/useReloadKey.ts`; `src/lib/inventory-stock.ts` | Create |
| `src/actions/auth.branch.ts` | Create |
| `src/app/sucursal/[branchId]/login/{page.tsx,PortalLoginForm.tsx}` | Create |
| `scripts/backfill-branch-authuserid.mjs` | Create |
| `src/app/actions/product.ts`; `inventory.ts` | Modify (D8) |
| `src/app/inventario/page.tsx`; `BottomNav.tsx` | Modify (D2/D6) |
| `src/app/inventario/components/{InventarioList,InventarioCard}.tsx` | Modify (D6/D7) |
| `src/app/ventas/page.tsx`; `compras/page.tsx` | Modify (D1) |
| `src/app/ventas/components/AddSaleButton.tsx`; `src/app/compras/components/AddPurchaseButton.tsx` | Modify (D1/D10) |
| `src/app/actions/purchase.ts` | Modify (D9) |
| `src/lib/context/BranchContext.tsx`; `src/lib/utils/supabaseAuth.ts` | Modify (D4/D5) |
| `src/app/actions/branch.ts`; `src/components/ui/BranchManager.tsx` | Modify (D5) |
| `src/proxy.ts`; `src/lib/supabase/branch.ts` | Modify (D2) |
| `src/actions/auth.ts`; `src/app/sucursal/[branchId]/inventory/page.tsx` | Modify (D3/D15) |

## Data Flow

```
Button ──onSuccess──▶ reloadKey.bump ──▶ load useEffect re-runs (fresh list)

/sucursal/210/login (proxy-excluded) ──loginBranch──▶ claim match ──▶ /sucursal/210/inventory
                                                    └─ mismatch ──▶ error, no redirect

usePathname() change ──▶ BranchContext.branchId = null
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `isValidUuid`, `sumStock`, `isPortalLoginPath` | pure-helper tests |
| Unit | BranchContext reset + no localStorage | RTL renderHook, pathname mock — RED before fix |
| Unit | `loginBranch` claim match/mismatch | mocked supabase client |
| Unit | `deleteBranch` invalid-UUID skip + user-not-found | extend `branch.test.ts` |
| Unit | Retry (P2024 once→success, twice→fail, log); AddPurchaseButton updates/ids/single-flight/onSuccess | extend `purchase.split.test.ts` (mock reject) + `AddPurchaseButton.test.tsx` |
| Unit | Active defaults | extend `product.test.ts` / `inventory.test.ts` |
| Verify | List refresh, move-stock refetch, export/move/edit, portal E2E | spec scenarios; `npm test`, `tsc --noEmit`, lint, build |

## Threat Matrix

| Boundary | Applicability | Reason |
|----------|---------------|--------|
| Documentation-like paths | N/A | No shell/executable-doc handling |
| Git repository selection | N/A | No VCS automation |
| Commit state | N/A | — |
| Push state | N/A | — |
| PR commands | N/A | — |

Only security boundary is web routing: `/sucursal/*/login` pre-auth reachable, `/sucursal/*/inventory` GET-only + `branch_user` — RED tests on `isPortalLoginPath` + `decideBranchAccess` tests.

## Migration / Rollout

One-off non-DDL backfill (idempotent). No migrations. Rollback: per-unit revert (files independent).

## Open Questions

- [ ] Issue 3 exact trigger unconfirmed — apply must instrument the first-failure log and re-run the retry-succeeds regression.
- [ ] `performedBy` uses email via `getUser()`; confirm no userId source is preferred.
