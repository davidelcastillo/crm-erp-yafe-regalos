# Exploration: fix-fase4-correcciones

15 bugs reported after user testing of the Fase 4 system (see `prompt-ver3/FIX-FASE4.md`).
This exploration identifies root causes with file:line evidence, compares fix approaches,
and groups cross-cutting concerns. No production code was written.

---

## Current State (summary)

- App Router + Next 16 (params are Promises), Supabase Auth, Prisma/Postgres.
- `/inventario`, `/compras`, `/ventas`, `/productos` are **client components** that fetch data in `useEffect`.
- `BranchSelector` (uncontrolled mode) writes a **global** `BranchContext` that persists to `localStorage` (`preferredBranch`).
- `InventarioCard` fires `getCategoryOptions()` **per card** on mount (N+1).
- `deleteBranch` calls Supabase `admin.deleteUser` with an unvalidated `authUserId`.
- Branch portal (`/sucursal/[branchId]/inventory`) is guarded by `src/proxy.ts` + `src/middleware/branch.ts` (GET-only, `branch_user` role).
- No dedicated external login; `login` action redirects by cookie/`/dashboard` regardless of role.

## Affected Areas

- `src/app/actions/product.ts` — `getProducts` missing `active` filter (issue 1)
- `src/app/actions/inventory.ts` — `getProductsWithBranchStock` `activeOnly` not passed by caller (issue 1)
- `src/app/inventario/page.tsx` — header buttons (issue 2), missing `activeOnly` (issue 1), client-page refresh (issue 7 pattern)
- `src/components/BottomNav.tsx` — `/inventario/inactivos` entry (issue 2)
- `src/app/compras/components/AddPurchaseButton.tsx` + `src/app/actions/purchase.ts` — multi-branch submit (issue 3)
- `src/app/inventario/components/InventarioCard.tsx` — per-card `getCategoryOptions` (issues 4, 8), `readBranchStock` (issue 6)
- `src/app/inventario/components/InventarioList.tsx` — `readStock` (issue 6)
- `src/lib/context/BranchContext.tsx` + `src/components/ui/BranchSelector.tsx` — persistent global branch (issue 5)
- `src/app/ventas/page.tsx` + `src/app/compras/page.tsx` — stale client lists after mutation (issue 7)
- `src/app/actions/branch.ts` + `src/lib/utils/supabaseAuth.ts` — `deleteBranchUser` UUID validation (issue 12)
- `src/components/ui/BranchManager.tsx` — per-branch portal button (issue 13)
- `src/actions/auth.ts` + `src/proxy.ts` + `src/middleware/branch.ts` — role-aware redirect / external login (issue 14)
- `src/app/sucursal/[branchId]/inventory/page.tsx` — `params` Promise (issue 15)

---

## Per-Issue Analysis

### Issue 1 — Inactive products still shown in /productos and /inventario

**Root cause (evidence):**
- `getProducts` (`src/app/actions/product.ts:119-136`): `where: branchId ? { inventory: { some: { branchId } } } : {}` — **no `active` filter**. Used by `/productos` page.
- `getProductsWithBranchStock` (`src/app/actions/inventory.ts:206-258`): `activeOnly` is optional and only applied `if (opts.activeOnly)` (line 210). The `/inventario` page calls it **without** `activeOnly` (`src/app/inventario/page.tsx:52-62`), so `where.active` is never set.

**Options:**
1. Default `active: true` in `getProducts` and make `getProductsWithBranchStock` apply `activeOnly` by default (or have the page pass `activeOnly: true`). `getInactiveProducts` explicitly filters `active: false` and is unaffected.
2. Keep actions as-is and filter client-side — rejected: inactive products still reach the client and appear in autocomplete lists.

**Recommendation:** Option 1. Set `active: true` in `getProducts` where, and default `activeOnly: true` in `getProductsWithBranchStock` (inventory is a listing of live stock; the inactivos page has its own explicit query). This also stops inactive products from appearing in purchase/sale product lists (the purchase action already rejects inactive products, `purchase.ts:255-257`, so UI and action become consistent).

### Issue 2 — Move "Inactivos" from BottomNav to a button in /inventario

**Root cause (evidence):** `src/components/BottomNav.tsx:58-67` — `navItems` includes `{ href: "/inventario/inactivos", label: "Inactivos" }` (line 66). The nav already holds 8 items on a mobile-width bar (violates mobile-design touch-target guidance; the bottom nav row is `h-16` with 8 flex items).

**Options:**
1. Remove the nav item; add a button next to "Exportar productos" (`src/app/inventario/page.tsx:155-161`) linking to `/inventario/inactivos`, styled with a different color (e.g., gray/neutral outline instead of the red `#ff385c` CTAs), keeping the existing `min-h-[44px]` touch-target pattern.
2. Keep the nav entry and also add the button — rejected: duplicates entry points and keeps the crowded nav.

**Recommendation:** Option 1. Button label "Inactivos", secondary color (neutral gray/`bg-[#f2f2f2]` text `#222222`), `min-h-[44px]`, `touch-manipulation`, consistent with the header button row.

### Issue 3 — Multi-branch purchase: first attempt errors, retry (modal open) succeeds

**Root cause (evidence, partially inferred):**
- The action `createPurchaseWithBranchSplit` (`src/app/actions/purchase.ts:218-344`) is deterministic for identical input: it validates (schema `src/lib/validations/purchase.ts:8-26`, branchId `z.number().int().positive("Sucursal inválida")`), verifies active branches (line 229-241), verifies active products (245-258), then runs a `$transaction` (270-327). `AddPurchaseButton` (`AddPurchaseButton.tsx:69-122`) maps fields with `parseInt`/`parseFloat` and filters empty rows, and it does **not** pass `performedBy`.
- Because the retry with the **same** modal state succeeds, the input is effectively identical → the failure is a **server-side transient**, not a data problem. The two most probable mechanisms:
  1. **Cold Prisma connection / first server-action invocation after idle (dev)** — the first `prisma.$transaction`/`findMany` can fail transiently; the action's generic catch (line 341-342) returns `"Error al registrar la compra con distribución"`, which the user paraphrased as "error con las sucursales".
  2. **Shared-pool pressure from the Issue-4 N+1** — every `InventarioCard` fires `getCategoryOptions()` (a server action + query each), saturating the Prisma pool; a purchase transaction submitted concurrently can fail on first try and succeed once the N+1 settles.
- Secondary latent risks worth hardening: `updateItem` uses the **stale `items` closure** (`AddPurchaseButton.tsx:53-57`, `setItems(items.map(...))`) and `addItem` uses `Date.now().toString()` ids (line 39) which can collide if two rows are added in the same millisecond.

**Options:**
1. Fix the pool pressure (Issue 4) + add a **bounded retry for transient Prisma errors** (P1001/P1008/P2024/P2034) inside `createPurchaseWithBranchSplit`.
2. Client hardening: pass `performedBy`, convert `updateItem` to functional updates (`setItems(prev => prev.map(...))`), stable item ids, and a single-flight guard (submit already disables via `loading`, but guard against re-entry before re-render).
3. Instrument the first-failure payload (log raw error + validated input) so the exact message is captured during apply/verify.

**Recommendation:** All three, primarily (1). The exact trigger is the one item this exploration cannot 100% pin statically — apply phase must confirm the fix eliminates the first-attempt error (and keep the retry-succeeds behavior as a regression check).

### Issue 4 & 8 — Category selector / branch filter hang (`getCategoryOptions` loop)

**Root cause (evidence):** `src/app/inventario/components/InventarioCard.tsx:64-72` — every card runs `getCategoryOptions()` (a server action hitting `prisma.category.findMany`, `src/app/actions/category.ts:176-190`) in a mount `useEffect`. `InventarioList` renders one card per product (`InventarioList.tsx:124-132`), so **N cards → N identical server actions/queries** on every filter change. This matches the log: `└─ ƒ getCategoryOptions() in 1277ms` repeated under `POST /inventario`. The page **already fetches categories once** (`src/app/inventario/page.tsx:88-97`) but never passes them down. Issue 8 (category filter) is the same cause — every filter change re-renders the list and re-fires N queries.

**Options:**
1. **Hoist categories**: pass the page's `categories` state → `InventarioList` → `InventarioCard` as a prop; remove the per-card fetch. Zero extra queries, smallest change.
2. Lazy-load categories only when entering edit mode (the only place a card needs them).
3. Module-level singleton cache around `getCategoryOptions` (helps other callers: `CategorySelector`, the page).

**Recommendation:** Option 1 (required), plus Option 3 as a cheap safety net for remaining callers. This is the **cross-cutting fix that unblocks Issues 9-11** (export/move/edit could not be tested because the page hung).

### Issue 5 — Branch selector persists across pages

**Root cause (evidence):** `BranchSelector` (`src/components/ui/BranchSelector.tsx:55-63`) in uncontrolled mode calls `setBranchId` → `BranchContext` persists to `localStorage` (`preferredBranch`, `src/lib/context/BranchContext.tsx:66-77`) and hydrates on mount (lines 50-63). All pages (`/inventario`, `/ventas`, `/productos`, `/compras`) use uncontrolled `BranchSelector`, so a selection carries across navigations (e.g., ventas → productos).

**Options:**
1. Reset the context `branchId` to `null` when `usePathname()` changes (provider-level effect), keeping the in-page filter stable during SPA navigation within the same route.
2. Remove `localStorage` persistence only — insufficient alone: the context lives above all pages, so in-memory state still survives SPA navigation.
3. Make each page's selector controlled with local state (bigger refactor; changes the HU2 shared-selection behavior).

**Recommendation:** Option 1 (reset on pathname change + clear the storage key). Verify in design that no consumer depends on the persisted value for defaults (AddSaleButton requires explicit branch selection; AddPurchaseButton only uses the `branches` list — both confirmed in source).

### Issue 6 — "Todas las Sucursales" shows only the first branch's stock

**Root cause (evidence):** `readStock` (`src/app/inventario/components/InventarioList.tsx:18-23`) and `readBranchStock` (`src/app/inventario/components/InventarioCard.tsx:39-47`) both read `inventory[0].stock`. With `branchId = null`, `getProductsWithBranchStock` includes **all** `BranchInventory` rows per product ordered by `branchId asc` (`src/app/actions/inventory.ts:234-240`), so `inventory[0]` is the lowest branch's stock, not the total.

**Options:**
1. When `branchId` is null, **sum** `inventory` rows in both readers (client-side; no schema change).
2. Add a server-computed `totalStock` aggregate per product and have the client prefer it in "all branches" mode.
3. Filter server-side to a single aggregate row per product when no branch is selected.

**Recommendation:** Option 1 for `/inventario` (both components), and align `ProductCard` (`src/app/productos/components/ProductCard.tsx:29-32`, which shows "—" with no branch) if the same UX applies to `/productos`.

### Issue 7 — Sales page does not refresh after registering a sale

**Root cause (evidence):** `VentasPage` is a client component; data is loaded in `useEffect` keyed on `[branchId, debouncedSearch]` (`src/app/ventas/page.tsx:33-59`). `AddSaleButton` calls `router.refresh()` on success (`AddSaleButton.tsx:181`), but `router.refresh()` re-renders **server** components and **preserves client state** — the `useEffect` deps do not change, so the list stays stale. `/compras` has the identical pattern (`src/app/compras/page.tsx`, data in `useEffect [branchId]`) and the same latent bug.

**Options:**
1. Add an `onSuccess`/refresh-token prop: the page holds a `reloadKey` state appended to the `useEffect` deps; the button calls it after success. Matches the existing `onConfirm` refetch pattern already used by `MoveStockModal` (`src/app/inventario/page.tsx:218-227`).
2. Convert the pages to server components driven by `searchParams` (larger refactor).
3. `window.location.reload()` (heavy; loses SPA UX).

**Recommendation:** Option 1, applied to `/ventas` (AddSaleButton) and `/compras` (AddPurchaseButton). 

### Issues 9-11 — Export / move stock / edit stock (untestable due to Issue 4)

**Analysis:** Blocked by the Issue-4 hang; no independent static blockers found:
- `ExportWizard` receives `branches` from the page and reads via `getProductsWithBranchStock`-based data (covered by `ExportWizard.test.tsx`).
- `MoveStockModal` receives `branches` prop; its `onConfirm` already refetches the list.
- Card edit uses `updateProductExtended`/`adjustProductStock` — flows run through `InventarioCard`, which also benefits from the Issue-4 fix (no more per-card category fetch).
Verify each flow end-to-end during apply once Issue 4 is fixed.

### Issue 12 — Deleting a branch fails: "Expected parameter to be UUID but is not"

**Root cause (evidence):** `deleteBranch` (`src/app/actions/branch.ts:188-277`) — inside the transaction, `if (branch?.authUserId)` (line 243) → `deleteBranchUser(serviceClient, branch.authUserId)` → `client.auth.admin.deleteUser(userId)` (`src/lib/utils/supabaseAuth.ts:138-144`). `@supabase/auth-js` **validates the UUID format and throws** when `authUserId` is a placeholder/non-UUID string (e.g., branches seeded or created before the auth-user provisioning feature). The throw propagates, rolls back the transaction, and the branch can never be deleted. Matches the reported stack: `supabaseAuth.ts:142` ← `branch.ts:245` ← `deleteBranch` (`branch.ts:199`).

**Options:**
1. Validate UUID format (regex) before `deleteUser`; if invalid, log and **skip** (don't abort the branch deletion).
2. Treat "user not found" / non-fatal `deleteUser` errors as non-blocking (only abort on genuine transport/API failures).
3. Data cleanup: backfill placeholder `authUserId` values to `null` (script/migration) so future deletes are clean.

**Recommendation:** Options 1 + 2 in `deleteBranchUser`/`deleteBranch` (UUID regex guard + non-fatal handling of missing users), plus Option 3 as a one-off data fix. Keep the throw for real failures so the transaction still protects consistency.

### Issue 13 — Button per branch to open the portal login

**Root cause (evidence):** `BranchManager` list view (`src/components/ui/BranchManager.tsx:331-404`) only renders Edit/Delete actions per branch.

**Options:**
1. Add a per-branch button linking to the dedicated portal login created for Issue 14 (e.g., `/sucursal/${branch.id}/login`).
2. Link directly to `/sucursal/${branch.id}/inventory` (relies on redirect-to-login for unauthenticated users).

**Recommendation:** Option 1 (aligns with the explicit "separate external login" requirement of Issue 14). Secondary style (neutral), `min-h-[44px]`, `touch-manipulation`, placed in the existing action cluster.

### Issue 14 — Branch login must redirect to its portal; separate external login

**Root cause (evidence):** `login` action (`src/actions/auth.ts:49-60`) redirects to the `redirect-to` cookie or `/dashboard` **regardless of role**. A `branch_user` landing on `/dashboard` hits the admin gate in `src/proxy.ts:71-81` → `/unauthorized`. There is no role-aware redirect and no dedicated portal login; `proxy.ts:32-37` only excludes the central `/login`.

**Options:**
1. **Role-aware redirect** in `login`: after `signInWithPassword`, read `user.app_metadata` — if `role === 'branch_user'`, redirect to `/sucursal/${app_metadata.branchId}/inventory`.
2. **Dedicated external login** route `/sucursal/[branchId]/login` + `loginBranch` server action that verifies the session's branch claim matches the URL branch and redirects to the portal. Requires `proxy.ts` to treat `/sucursal/*/login` as reachable pre-auth (extend the exclusion list or special-case the `/sucursal/` branch), while keeping `/sucursal/[id]/inventory` GET-only + `branch_user` (per `src/middleware/branch.ts`).

**Recommendation:** Option 2 (the user explicitly asked for a login that does not mix with the central one) **plus** Option 1 (convenience so branch users can also use the central `/login` and land on their portal). Keep the branch middleware strict for everything except the login route itself.

### Issue 15 — `params.branchId` used without `await` (Next 16 async params)

**Root cause (evidence):** `src/app/sucursal/[branchId]/inventory/page.tsx:15` — `parseInt(params.branchId, 10)` on a Promise. Next 16 makes `params` a Promise; the log confirms the exact error at `page.tsx:15:36`, producing the 404 + `unhandledRejection: TypeError: Failed to fetch`.

**Options:**
1. Type `params: Promise<{ branchId: string }>` and `const { branchId } = await params;` at the top of `BranchInventoryPage`.
2. `React.use(params)` equivalent (same unwrap).

**Recommendation:** Option 1 (canonical `await params`). During apply, grep for other page components using synchronous `params.` to catch siblings.

---

## Cross-Cutting Concerns

1. **Issue 4 fix unblocks Issues 9-11** and reduces global Prisma pool pressure, which also hardens the Issue-3 transient failure.
2. **Shared client-page pattern**: `/inventario`, `/compras`, `/ventas` all load data in `useEffect`; the refresh-token fix for Issue 7 should be applied consistently (a shared pattern or small hook), not only to `/ventas`.
3. **Active filtering alignment**: `getProducts` and `getProductsWithBranchStock` must agree on `active` filtering (Issue 1) so `/productos`, `/inventario`, and the purchase/sale pickers behave consistently (inactive products are already rejected server-side by the purchase action).
4. **BranchContext is global and persisted** (Issue 5): any reset-on-navigation change affects every page using `BranchSelector`; verify consumers (`AddSaleButton`, dashboards) during design/apply.
5. **Branch portal auth model** (Issues 13-15): the external login route needs a carefully scoped proxy exclusion; `/sucursal/*/inventory` must remain GET-only for `branch_user`.

## Risks

- **Issue 3**: exact first-attempt trigger not statically confirmed — if apply only hardens without addressing the real trigger, the error may persist intermittently. Mitigation: instrument first-failure logging and re-test the retry scenario.
- **Issue 5**: resetting BranchContext on navigation could surprise users who expect their "preferred branch" to persist (current localStorage behavior) — confirm the product intent (user explicitly asked for per-page reset).
- **Issue 1**: defaulting listings to active-only changes autocomplete/picker data — desired, but verify no flow relies on picking inactive products for restocking (reactivation lives in `/inventario/inactivos`).
- **Issue 14**: the proxy exclusion for the portal login must be narrowly scoped to avoid opening `/sucursal/*` data to unauthenticated access.
- **Issue 12**: skipping orphaned Supabase user deletion leaves stale auth users for placeholder branches — acceptable, but should be documented and cleaned up by the backfill script.

## Ready for Proposal

**Yes.** Root causes are identified with evidence for 14 of 15 issues; Issue 3's trigger is narrowed to a transient server-side failure (with hardening plan) and will be confirmed with instrumentation during apply. The proposal should be one change (multi-domain) or split into two: (A) inventory/product/data fixes (1, 2, 4, 6, 7, 8, 9-11) and (B) branch portal + admin fixes (3, 5, 12, 13, 14, 15), with 4 and 3 chained first.
