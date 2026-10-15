# Proposal: Fase 4 Corrections (15 bugs)

## Intent

Fix 15 Fase-4 defects (`FIX-FASE4.md`; root causes in `exploration.md`; issue 3 transient → instrumented in apply). No schema changes (one non-DDL backfill).

## Scope

**In:** active-only listing defaults; Inactivos button in `/inventario`, off BottomNav; purchase retry + hardening; category N+1 fix; branch filter reset on nav; "Todas" stock sum; list refetch; export/move/edit re-test; `deleteBranch` UUID guard + non-fatal + NULL backfill; portal-login button; external branch login; `await params`.
**Out:** new features; BranchContext redesign; server-component conversion; migrations.

## Capabilities

> Contract with sdd-spec (no portal/auth spec).

### New
- `branch-portal-access`: `/sucursal/[branchId]/login` + `loginBranch`, role redirect, `await params`, scoped proxy exclusion (portal stays GET + `branch_user`).

### Modified
- `inventory-ui`: active-only default, Inactivos header button, hoisted categories, summed "Todas" stock (1, 2, 4, 6, 8).
- `product-soft-delete`: `getProducts` defaults `active: true` (1).
- `sale-with-branch`: post-sale list refetch (7).
- `purchase-with-branch-split`: transient retry + client hardening (3, 7).
- `branch-management`: non-fatal UUID-guarded delete; portal-login button (12, 13).

## Approach

Chained PRs A → B → C (A first: N+1 fix unblocks 9-11, eases pool pressure).

| Unit | Issues | Approach |
|------|--------|----------|
| **A — inventario/productos** | 1, 2, 4, 6, 7, 8, 9-11 | `active: true` defaults; Inactivos button, nav drop; hoist categories + cache; sum inventory on "Todas"; `reloadKey` refetch. |
| **B — purchase reliability** | 3 | Retry transient Prisma errors; functional `setItems`, stable ids, `performedBy`; log first-failure; regression. |
| **C — sucursales/portal** | 5, 12, 13, 14, 15 | Reset `BranchContext` on pathname; clear `preferredBranch`; UUID guard, skip non-fatal, NULL backfill; `loginBranch` + role redirect; scoped proxy exclusion; `await params`. |

## Affected Areas

Actions (`product/inventory/category/purchase/branch`), `inventario/**`, `BottomNav`/`BranchSelector`/`BranchManager`, `BranchContext`/`supabaseAuth`, `ventas`+`compras` pages, `auth`/`proxy`/`branch` middleware, `sucursal/[branchId]/{login, inventory}`.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Issue 3 trigger unconfirmed | Med | Instrument first-failure |
| Issue 5 kills localStorage preference | Med | Confirm intent |
| Issue 14 proxy exclusion opens portal data | Med | Exclude login route only |
| Issue 1 blocks inactive-restock flows | Low | Reactivation in `/inventario/inactivos` |
| Issue 12 leaves stale Supabase users | Low | Documented; backfill cleans |

## Proposal question round

Confirm: reset-intent (5); retry+instrumentation (3); NULL backfill (12); active-only (1); sum scope (6).

## Rollback Plan

Per-unit revert (independent files). No migrations; retry/UUID/cache additive. Backfill one-off UPDATE (dump kept).

## Dependencies

Existing actions/context/middleware; no new libs.

## Success Criteria

- [ ] `npm test`, `tsc --noEmit`, `lint`, `build` green.
- [ ] Issues 1-15 manually verifiable (list in spec).
- [ ] N+1 gone: one category fetch per render (log check).
- [ ] First-attempt purchase succeeds; retry regression passes.
