# Exploration: mejoras-f3-f4

7 improvements/bugs reported after user testing of Fase 3/4 (source: `prompt-ver3/Ultima-mejoras-F3-.md`).
This exploration identifies root causes with file:line evidence, compares fix approaches, and flags
cross-cutting concerns. No production code was written.

---

## Current State (summary)

- Next.js 16.2.4 App Router, Supabase Auth, Prisma/Postgres, Tailwind v4. `params` are Promises.
- Root layout (`src/app/layout.tsx`, `force-dynamic`) fetches `getBranchOptions()` server-side and
  hydrates `BranchProvider` via `BranchProviderWrapper`. It also renders `<Navbar />` and `<BottomNav />`
  **globally** — there are no route groups (only the root layout exists).
- `BranchContext` (client) holds `branches` in `useState(initialBranches)`; selection is reset per route
  group on navigation; **no code path ever calls `refreshBranches()`** (grep: only tests).
- `BranchProvider` mounts on the pre-auth `/login` render with an empty list (auth-gated fetch) and the
  provider **never re-syncs** when the layout later re-renders with real branches.
- Inventory UI already uses `sumStock()` (`src/lib/inventory-stock.ts`) — the old category N+1 is fixed
  (categories are hoisted, no per-card fetches). `/productos` does NOT use it yet.
- External portal (`/sucursal/[branchId]/inventory`) is a server component under the same root layout
  (shows BottomNav), protected by `proxy.ts` + `decideBranchAccess` (GET-only, `branch_user`).

---

## Per-Item Analysis

### Item 1 — Branch selector empty for ~10 min after start (filters + purchase modal)

**Root cause (evidence):**
- `getBranchOptions()` (`src/app/actions/branch.ts:299-322`) returns `{ success: true, data: [] }` when
  `supabase.auth.getUser()` has no user (lines 307-309). The root layout calls it on every render
  (`src/app/layout.tsx:33`), including the **pre-auth** `/login` page → `initialBranches = []`.
- `BranchProvider` initializes `useState<BranchOption[]>(initialBranches)` (`src/lib/context/BranchContext.tsx:55`)
  and has **no effect that re-syncs state when `initialBranches` changes**. `refreshBranches` exists
  (lines 75-81) but no application code calls it.
- After login the app navigates client-side (`router.push`, same pattern as `PortalLoginForm.tsx:37`),
  so the already-mounted provider keeps `branches = []` indefinitely. The selector only recovers on a
  full remount (hard reload) — the user-perceived "~10 minutes" until they reloaded.
- The old Prisma pool saturation (category N+1) is **not** the cause anymore: `InventarioCard`/
  `InventarioList` hoist categories and use `sumStock` (verified in source).

**Options:**
1. **Self-heal in `BranchProvider`** — add a sync effect: when `initialBranches` becomes non-empty, set it;
   when it is empty on mount, call `refreshBranches()` (client-side fetch has the session cookie and
   reliably returns branches post-login). Guard so it never clobbers a manual `refreshBranches` result.
   - Pros: fixes all navigation paths; keeps the server fast-path; small, contained change.
   - Cons: must not break the route-group reset effect (`BranchContext.tsx:63-69`); needs a guard against
     extra DB calls on every navigation.
   - Effort: Medium
2. **Hard navigation after login** — `router.replace` + `router.refresh()` (or server `redirect()` from
   the login action) so the provider remounts with fresh branches.
   - Pros: trivial.
   - Cons: only fixes the login path; other stale-hydration scenarios remain (e.g. tab restored, session
     refresh at token boundary).
   - Effort: Low
3. **Fetch branches fully client-side** — drop `getBranchOptions` from the layout; `BranchProvider`
   always fetches on mount.
   - Pros: simplest mental model; eliminates the pre-auth-empty class of bugs.
   - Cons: loses the server fast-path; one extra round-trip per app start.
   - Effort: Low
4. **Route-group `/login` with its own minimal layout** (no `BranchProviderWrapper`) so the provider only
   mounts post-login.
   - Pros: cleanest architecture.
   - Cons: structural change (folder moves, layout churn) for a small benefit.
   - Effort: High

**Recommendation:** Option 1 (self-heal effect + empty-fallback fetch), optionally combined with Option 2
as belt-and-suspenders. The exact "10-minute" trigger is inferred statically; the fix addresses the
mechanism regardless of the precise timing — validate the login → selector flow during apply.

### Item 2 — ExportWizard: "Expected object, received number"

**Root cause (evidence, confirmed):**
- `src/app/inventario/components/ExportWizard.tsx:52` calls `getBranchProductsForExport(branchId)` with a
  **number**, but the action parses an object schema `{ branchId }`
  (`src/app/actions/inventory.ts:516-518`). Zod throws "Expected object, received number", which the
  catch block surfaces as the wizard's `productsError` (`ExportWizard.tsx:59`).
- Grep confirms this is the **only** wrong call site: `MoveStockModal.tsx:40` and the portal page
  (`inventory/page.tsx:35`) pass `{ branchId }` correctly.
- The unit test **encodes the bug**: `ExportWizard.test.tsx:112` asserts `toHaveBeenCalledWith(1)` — the
  mocked action swallows the bad signature, so the test passes while production throws.

**Options:**
1. Fix the call site to `getBranchProductsForExport({ branchId })` and update the test assertion to
   `{ branchId: 1 }`; add a small action-level test asserting a bare number is rejected.
2. Make the action accept both shapes (coerce) — rejected: hides the bug, weakens the contract.
- Effort: Low

**Recommendation:** Option 1 (one-line fix + test update + optional regression test).

### Item 3 — /productos stock total shows only one branch

**Root cause (evidence):**
- `getProducts` (`src/app/actions/product.ts:119-139`): with no `branchId` the include is
  `inventory: { where: { branchId: undefined }, select: { stock } }` → Prisma returns **all** branch rows
  per product. `ProductCard` (`src/app/productos/components/ProductCard.tsx:29-36`) reads
  `inventory?.[0]?.stock` → shows only the first branch's stock (and "—" for no inventory).
- `/inventario` already solved this with `sumStock` (`src/lib/inventory-stock.ts:10-13`), used by
  `InventarioCard.tsx:43` and `InventarioList.tsx:21-23`.
- Bonus finding: `src/app/productos/page.tsx:107` — the products grid div is
  `className="gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"` **missing the base `grid` class**, so
  products render as a single column on all breakpoints.

**Options:**
1. `ProductCard` always uses `sumStock(product)` — correct in both views (branch-scoped include yields one
   row; "Todas" yields the total); show "—" only when `inventory` is empty. Add the missing `grid` class
   on the page.
2. Pass the resolved total as a prop from the page — unnecessary indirection.
- Effort: Low

**Recommendation:** Option 1. `sumStock` matches the existing `/inventario` pattern (consistency + reuse).

### Item 4 — Sale with MIXTO: no cash/transfer inputs → "se requiere una cantidad en efectivo o transferencia mayor a 0"

**Root cause (evidence, confirmed — this is the multi-item form):**
- `registerSaleSchema` (`src/app/actions/sale.ts:19-36`) refines MIXTO to require
  `cashAmount + transferAmount > 0`. `computePayment` (`src/lib/utils/payment.ts:44-46`) sets
  `amountPaid = cash + transfer` for MIXTO (0 when absent) — so MIXTO **ignores** `amountPaid`.
- `AddSaleButton` (the "Nueva Venta" multi-item form the user means — its "Monto Pagado" field is the
  "saldo pagado general") submits `{ items, branchId, customerId, paymentMethod, amountPaid }` with **no
  cashAmount/transferAmount** (`AddSaleButton.tsx:160-170`). The UI has a MIXTO button
  (`AddSaleButton.tsx:328-346`) and a single "Monto Pagado" input (`:366-381`) — no split inputs.
  Selecting MIXTO + amountPaid=total → the refine rejects with exactly the reported message.
- Even without the refine, MIXTO would record `amountPaid = 0` (full pending) because
  `computePayment` ignores `amountPaid` for MIXTO.
- `SaleForm` (single-product quick sale) has the **same latent gap**: submits
  `{ productId, branchId, quantity, price, paymentMethod }` with no cash/transfer
  (`SaleForm.tsx:52-58`) and a MIXTO option (`SaleForm.tsx:170-173`).

**Options:**
1. Add conditional **cash/transfer inputs** when MIXTO is selected, in BOTH forms; client-side validation
   (at least one > 0); send `cashAmount`/`transferAmount` and let the server compute `amountPaid`. In
   MIXTO mode, hide/disable the single "Monto Pagado" input (or auto-derive it as cash+transfer).
2. Loosen the refine to accept `amountPaid` as a fallback for MIXTO — rejected: contradicts
   `computePayment` semantics and the user's mental model (they want to enter the split).
- Effort: Medium

**Recommendation:** Option 1, applied to both forms. Keep the server refine as a safety net. Note:
`SaleForm` has no covering tests; `registerSale` does (`sale.test.ts`, `sale.branch.test.ts`) — add MIXTO
UI coverage for the new inputs.

### Item 5 — Export only products with stock > 0

**Root cause: already satisfied — no code change needed (verified):**
- `getBranchProductsForExport` filters `stock: { gt: 0 }` (`src/app/actions/inventory.ts:529-533`).
- `ExportWizard.availableProducts` filters `row.stock > 0` (`ExportWizard.tsx:68-71`).
- `exportBranchProductsPdf` re-validates `stock: { gt: 0 }` and rejects any product not in that set
  (`inventory.ts:585-607`).
- Covered by `ExportWizard.test.tsx:106-120` (3 mock rows, 1 with stock 0 → only 2 checkboxes).

**Recommendation:** No code change. Verify during apply. **Do NOT** apply the same filter to
`getExternalBranchInventory` (`src/app/actions/inventory.external.ts:21-28`) — the portal is a full
read-only inventory view and intentionally includes zero-stock items (that is not the export).

### Item 6 — BottomNav (and Navbar) shown on the branch portal

**Root cause (evidence):** `src/app/layout.tsx:45-47` renders `<Navbar />` and `<BottomNav />` for every
route, including `/sucursal/[branchId]/inventory` and the portal login. There are **no route groups**
(glob confirms only the root layout exists). The portal is a standalone read-only page that should not
offer admin navigation ("no la opcion de mover o buscar otras paginas").

**Options:**
1. **Guard in `BottomNav` + `Navbar`** — both are client components; `BottomNav` already uses
   `usePathname()` (`BottomNav.tsx:62`): `if (pathname.startsWith('/sucursal')) return null;` (same for
   Navbar via a small client wrapper or an internal guard).
   - Pros: minimal, no folder moves, no link churn.
   - Cons: chrome-hiding logic lives in two components (or one small wrapper).
   - Effort: Low
2. **Route group `(admin)/` with its own layout** for internal pages — architecturally clean, but moves
   every page folder and risks broken imports/links/tests.
   - Effort: High
3. **`AppChrome` client wrapper** (single component rendering Navbar+BottomNav with the pathname guard)
   replaced into the root layout — one point of control.
   - Effort: Low-Medium

**Recommendation:** Option 1/3 (a single `AppChrome` wrapper is the tidiest). Recommend hiding **both**
Navbar and BottomNav for `/sucursal/*` so the portal is fully standalone — the user only asked for
BottomNav, so confirm this in proposal. The portal pages already bring their own padding/layout.

### Item 7 — External inventory table: code + name cramped on mobile

**Root cause (evidence):** `src/lib/components/ExternalInventoryTable.tsx` uses a fixed grid
`grid-cols-[60px_1fr_80px_100px]` for the header (`:30`) and rows (`:40`); the name cell truncates
(`truncate max-w-[200px]`, `:42`). On a ~360-414px phone the name column collapses to ~120px → code and
name look "amontonados".

**Options:**
1. **Responsive 2-column mobile layout** — rows become `grid grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px]`:
   on mobile, column 1 = code + name (name wraps, drop truncate), column 2 = stock + price stacked and
   right-aligned; the header row mirrors the same responsive classes.
   - Pros: names readable, numeric data stays aligned; no scroll.
   - Cons: header/row must share the responsive grid classes.
   - Effort: Low
2. Stack each row vertically on mobile (name full-width, meta row beneath) — also valid, slightly taller
   rows.
3. Horizontal scroll container — rejected: bad mobile UX (the reported problem).
- Effort: Low

**Recommendation:** Option 1 (aligns with mobile-design skill: readable text, aligned numerics, no
desktop-table emulation). Keep row padding ≥ `py-3`.

---

## Cross-Cutting Concerns

1. **Item 1 is the only stateful, shared-behavior change.** The self-heal effect in `BranchProvider`
   must coexist with the route-group reset (`BranchContext.tsx:63-69`) and never clobber `refreshBranches`
   results — cover with `BranchContext.test.tsx` updates during design/apply.
2. **Items 2 + 5 share the ExportWizard surface.** Fixing the call signature must update
   `ExportWizard.test.tsx:112` (which currently asserts the buggy call) to avoid a regression-encoding test.
3. **Item 4 touches both sale forms.** Apply the same MIXTO UI pattern in `AddSaleButton` and `SaleForm`;
   `computePayment` semantics mean MIXTO must NOT send a conflicting `amountPaid`.
4. **Items 3 + 7 share the "stock display" domain** but are separate surfaces (admin `/productos` vs
   external portal table).
5. **Item 6 hides admin chrome for `/sucursal/*`** — also affects the portal login route; keep the portal
   standalone (Navbar too, pending user confirmation).
6. **Item 5 must be verified, not "fixed".** The portal inventory action intentionally includes
   zero-stock items; the stock>0 filter belongs to the export path only.

## Risks

- **Item 1**: the ~10-minute timing is inferred (provider staleness + pre-auth mount). The self-heal fix
  addresses the mechanism, but apply must validate the login → selector flow end-to-end and confirm no
  extra DB round-trips on every navigation (guard the mount fetch).
- **Item 4**: MIXTO derives `amountPaid` from cash+transfer only — a UI that also sends `amountPaid`
  would still be ignored; the refine message remains the server-side safety net.
- **Item 3**: `sumStock` shows "0 uds" for products with zero inventory rows (today: "—") — confirm the
  desired label with the user.
- **Item 6**: hiding the Navbar for `/sucursal/*` is a small scope extension beyond the literal request —
  confirm in proposal.
- **Item 2**: fixing the signature changes a tested contract — update the test in the same commit or CI
  will (correctly) fail.

## Ready for Proposal

**Yes.** Root causes are confirmed with evidence for 6 of 7 items; Item 5 is verified as already
implemented (verify-only). Recommended packaging: one proposal for the full change, or three chained PRs —
(A) low-risk data/UI fixes: items 2, 3, 5, 7; (B) medium-risk: items 1, 4; (C) chrome/nav: item 6 — at the
orchestrator's delivery-strategy discretion.
