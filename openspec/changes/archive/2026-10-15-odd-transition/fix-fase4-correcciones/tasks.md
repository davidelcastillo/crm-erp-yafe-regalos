# Tasks: Fase 4 Corrections (15 bugs)

## Review Workload Forecast

Estimated changed lines: ~720–870 (A 220–270, B 180–220, C 320–380). 400-line budget risk: High. Chained PRs recommended: Yes (split PR A → PR B → PR C).

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | issues 1,2,4,6,7,8,9-11 | PR A | `npx jest product.test inventory.test BottomNav.test` | dev: /inventario filters, "Todas" sum, move, export | revert product.ts, inventory.ts, inventario/*, ventas/*, BottomNav.tsx |
| B | issue 3 | PR B | `npx jest purchase.split.test AddPurchaseButton.test` | dev: multi-branch compra first attempt | revert purchase.ts, AddPurchaseButton.tsx, compras/page.tsx |
| C | issues 5,12,13,14,15 | PR C | `npx jest branch.test supabaseAuth.test auth.branch.test` | dev: portal login success/mismatch, deleteBranch | revert BranchContext, proxy, branch, auth.branch, auth, sucursal/* |

## Phase 1: Foundation (shared helpers)

- [x] 1.1 Create `src/lib/hooks/useReloadKey.ts`: `[key, bump]`.
- [x] 1.2 Create `src/lib/inventory-stock.ts` `sumStock()` (AD7); RED first.
- [x] 1.3 Export `UUID_V4_REGEX`/`isValidUuid` from `src/lib/utils/supabaseAuth.ts` (AD5); RED first.
- [x] 1.4 Add `isPortalLoginPath()` to `src/lib/supabase/branch.ts`; RED first.

## Phase 2: A — inventario/productos

- [x] 2.1 `src/app/actions/product.ts` + `inventory.ts`: default `active: true`/`activeOnly: true` (D8); RED-first in `product.test.ts` + `inventory.test.ts`.
- [x] 2.2 `src/app/inventario/page.tsx`: hoist `categories` + `activeOnly: true`; add Inactivos button (secondary 44px) (D2/6/8).
- [x] 2.3 `src/components/BottomNav.tsx`: drop `/inventario/inactivos`; update `BottomNav.test.ts` RED-first.
- [x] 2.4 `src/app/inventario/components/InventarioList.tsx`: `sumStock` on null branch; accept `categories` (D6/7).
- [x] 2.5 `src/app/inventario/components/InventarioCard.tsx`: drop mount `getCategoryOptions()`; use `categories` + `sumStock` (D6).
- [x] 2.6 `src/app/ventas/page.tsx` + `compras/page.tsx`: add `reloadKey` dep; `AddSaleButton.tsx`: `onSuccess={bump}` (D1).
- [x] 2.7 Verify export/move/edit (9-11) in `/inventario`; `ExportWizard.test.tsx` green.

## Phase 3: B — compras (issue 3)

- [x] 3.1 `src/app/actions/purchase.ts`: extract `executePurchase()`; retry ≤3 on P1001/P1008/P2024/P2034; log first failure (D9); RED-first `purchase.split.test.ts` (P2024 once→success, twice→fail).
- [x] 3.2 `src/app/compras/components/AddPurchaseButton.tsx`: functional `setItems`, ref-counter ids, `performedBy` via `getUser()`, single-flight, `onSuccess` (D10); RED-first `AddPurchaseButton.test.tsx`.
- [x] 3.3 `src/app/compras/page.tsx`: `reloadKey` dep + pass `bump`.

## Phase 4: C — sucursales/portal (5,12,13,14,15)

- [x] 4.1 `src/lib/context/BranchContext.tsx`: reset on `usePathname()` change; drop localStorage/`preferredBranch` (D4); RED-first renderHook + pathname mock.
- [x] 4.2 `src/lib/utils/supabaseAuth.ts` `deleteBranchUser`: invalid UUID → warn+skip; user-not-found → non-fatal (D5); RED-first `supabaseAuth.test.ts`.
- [x] 4.3 `src/app/actions/branch.ts` `deleteBranch`: apply guard; throw on real errors (D5).
- [x] 4.4 Create `scripts/backfill-branch-authuserid.mjs`: idempotent, non-UUID → NULL (D5).
- [x] 4.5 `src/components/ui/BranchManager.tsx`: per-branch Portal button → `/sucursal/{id}/login` (secondary, 44px) (13).
- [x] 4.6 `src/proxy.ts`: exclude `isPortalLoginPath`; skip branch guard (D2); RED-first `decideBranchAccess` in `src/middleware/branch.test.ts`.
- [x] 4.7 Create `src/actions/auth.branch.ts` `loginBranch`: match → portal; mismatch → error (D3); RED test.
- [x] 4.8 Create `src/app/sucursal/[branchId]/login/{page.tsx,PortalLoginForm.tsx}` (D3).
- [x] 4.9 `src/actions/auth.ts` `login`: role redirect: branch_user → `/sucursal/{branchId}/inventory`.
- [x] 4.10 `src/app/sucursal/[branchId]/inventory/page.tsx`: `await params` + Promise type (D15); grep `params.` siblings.

## Phase 5: Verification

- [x] 5.1 `npm test`; `tsc --noEmit`; `lint`; `build` green.
- [ ] 5.2 Manual: portal login success/mismatch, deleteBranch non-UUID, retry regression, N+1 log check.
