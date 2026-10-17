# Exploration: FASE 4 — UI Improvements, External Portal, Export Wizard (PDF), Branch User Auto-Creation

Source: `prompt-ver3/FASE4.md` — requirements R1 (UI/filters/portal), R2 (export branch products PDF wizard), R3 (auto-create Supabase branch user on branch registration).

## Current State

### R1 — UI improvements, filters and external portal

- **Inventory unified search: NOT implemented.** `src/app/inventario/page.tsx` loads products via `getProducts` / `getProductsWithBranchStock` and filters with `BranchSelector` (branch) + `InventoryFilters` (category only). `InventarioList` has a client-side input filtering `name` + `description` (no debounce, no code, no category) plus a separate inline `ProductSearch` (server-side `searchProducts`, 300 ms debounce, matches `code` + `name` only, returns `[]` for empty query, `take: 20`). No single debounced input covering name/code/description/category with "empty query → full list".
- **Sales search: NOT implemented.** `src/app/ventas/page.tsx` renders `SalesList` with no input. `getSales` (`src/app/actions/sale.ts`) supports `branchId`, `startDate`, `endDate` only — no product search, and no pagination (no take/skip anywhere).
- **Dashboard custom cards: PARTIAL.** `src/app/dashboard/page.tsx` has a branch `BranchSelector` but NO period selector. `getGlobalStats` is all-time (no date filter); `getPerformanceData({ days })` supports only trailing-N-days (page hardcodes 30). There is no generic `getStats(type, startDate, endDate, branchId?)`. `DashboardCards` renders 4 static cards — no customization.
- **External portal `/sucursal/[branchId]/inventory`: DOES NOT EXIST.** No `src/app/sucursal/` directory. `src/middleware.ts` excludes `/sucursal/*` from auth but no route exists. No `src/middleware/branch.ts`. There is NO role system anywhere: middleware checks session only; `useAuth` returns `{ email }` only; `getUser` (`src/actions/auth.ts`) returns email only. No `user_roles` table, no `app_metadata` claims usage. An archived (HU2) `user-management` spec describing optional `branchId` on a user profile was never implemented.
- `NEXT_PUBLIC_FEATURE_*` flags documented in `AGENTS.md` are NOT used in code (grep found zero matches in `src/`); `NEXT_PUBLIC_APP_ENV` also unused. Categories are effectively always enabled (`Product.categoryId` nullable).

### R2 — Export branch product list (PDF wizard)

- **Not implemented.** No "Exportar productos" button on `src/app/inventario/page.tsx`, no `ExportWizard`, no `exportBranchProductsPdf`, no `generateProductsPdf`, no `src/lib/validations/export.ts`.
- `pdf-lib@1.17.1` IS installed and already used by `src/actions/label-print.ts` (`PDFDocument, rgb, StandardFonts`), which returns a base64 PDF string and ships unit/integration/e2e jest tests that mock `pdf-lib`. This is the established PDF pattern to follow.
- `src/app/actions/inventory.ts#getBranchInventory(branchId)` returns products with `stock > 0` for a branch (`id`, `name`, `stock` only — no `code`/`price`). `getProductsWithBranchStock` includes `category` + `inventory` but no stock>0 filter and no flat projection. The wizard needs `code | name | stock | price` per product.
- `BranchSelector` exists as a dropdown (dropdown acceptable per FASE4: "type-ahead o dropdown"), sourced from `BranchContext` (active branches, id+name).
- **`Branch` model has NO `code` field** (`prisma/schema.prisma`). PDF filename `inventario-<branchCode>-<YYYYMMDD>.pdf` (criterion 8) and email `sucursal-{code}@...` (R3) require it. Seed (`prisma/seed.ts`) creates branch "Depósito" without code. `deleteBranch` already protects `id === 1`.

### R3 — Auto-create branch user

- **Not implemented.** `createBranch` (`src/app/actions/branch.ts`) only inserts into `Branch`; `deleteBranch` only deletes the row (with id=1 / dependent-data / stock guards). No Supabase Auth calls anywhere.
- **No service-role client.** `src/lib/supabase/server.ts` builds a client with the ANON key only. `.env` DOES define `SUPABASE_SERVICE_ROLE_KEY` (and anon key), but no code reads it — `supabase.auth.admin.createUser/deleteUser` are unavailable today.
- **No role storage mechanism** (see R1): FASE4 requires assigning role `branch_user` (custom claim or `user_roles` table). Neither exists. Because middleware runs on the Edge runtime (Prisma unavailable), custom claims (`app_metadata`) are the only low-friction option for middleware role checks.
- `createBranchSchema` (`src/lib/validations/branch.ts`) has no `code` field. `BranchManager.tsx` create form has no code input, no generated-credentials display, and reloads the page on success. SweetAlert2 is already used for delete confirmation and can surface credentials.
- Transactionality: DB insert + Auth `createUser` cannot share a DB transaction — FASE4 mandates try/catch with compensating rollback (delete `Branch` row if user creation fails; for delete, remove Auth user first, abort branch deletion on failure).

## Affected Areas

- `src/app/inventario/page.tsx` — add unified debounced search + "Exportar productos" button + wizard integration.
- `src/app/inventario/components/InventarioList.tsx` — consolidate duplicate search inputs into one debounced filter (name/code/description/category).
- `src/app/inventario/components/InventoryFilters.tsx` — extend category filter; integrate with unified search.
- `src/app/actions/inventory.ts` — add search param to `getProductsWithBranchStock` (or new action) and a branch-products projection with `code|name|stock|price`; new `exportBranchProductsPdf`.
- `src/app/actions/product.ts` — `searchProducts` already matches code+name with 300 ms debounce; extend if reused for sales search or keep as-is.
- `src/app/actions/sale.ts` — `getSales`: add product search (`Product.name`/`code` contains, insensitive) + pagination; optional new `searchSalesByProduct`.
- `src/app/ventas/page.tsx`, `src/app/ventas/components/SalesList.tsx` — add search input, keep branch/date/payment filters.
- `src/app/dashboard/page.tsx` — add period select (7/30/90/custom) next to branch selector.
- `src/app/actions/dashboard.ts` — generic `getStats(type, startDate, endDate, branchId?)`; add date ranges to stats; cards data per type.
- `src/app/dashboard/components/DashboardCards.tsx` — render per-type metrics, optional "(Sucursal X)" / "(Todas)" label.
- `src/app/sucursal/[branchId]/inventory/page.tsx` — NEW read-only portal page (does not exist).
- `src/middleware.ts` — stop excluding `/sucursal/*`; delegate to branch middleware; add admin-role gating for admin routes (currently none).
- `src/middleware/branch.ts` — NEW: branch_user role + URL branchId === user branchId + GET-only (403 otherwise).
- `src/app/actions/branch.ts` — `createBranch`/`deleteBranch` gain Auth user create/delete + credentials return; `getBranches`/`getBranchOptions` unchanged; new `getProductsWithBranchStock`-style reads for wizard live in inventory.
- `src/components/ui/BranchManager.tsx` — code field, credentials display (SweetAlert2), no page reload on success.
- `src/lib/supabase/server.ts` — add `createServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY` (env var present, unused).
- `src/lib/utils/supabaseAuth.ts` — NEW: `createBranchUser`, `deleteBranchUser`, `generateTemporaryPassword`, `generateBranchEmail`.
- `src/lib/validations/branch.ts` — add `code` (unique) to create/update schemas.
- `src/lib/validations/export.ts` — NEW zod schema `{ branchId: int+, selectedProductIds: int+[] min 1 }`.
- `src/lib/utils/pdf.ts` — NEW `generateProductsPdf(data)` following the `label-print.ts` pdf-lib pattern.
- `prisma/schema.prisma` + migration — add `Branch.code` (unique). NO migrations folder exists yet; `prisma migrate dev` will create one.
- `prisma/seed.ts` — seed default branch with `code` (FASE4: id=1 "Deposito" code "DEP").
- Tests: colocated `*.test.ts` convention (NOT `src/tests/unit`, which does not exist). `label-print` PDF tests (mock `pdf-lib`) are the template. openspec `config.yaml` declares integration/e2e unavailable (Playwright not installed) — existing "integration"/"e2e" jest tests are mocked, not real DB/E2E.

## Approaches

1. **R1 search/filters — server-driven extension of existing actions**
   Add optional `search` param to `getProductsWithBranchStock` (OR on name/code/description; category match via `category.name` contains when set) and to `getSales` (OR `items.some.product.name/code` contains, insensitive) with take/skip pagination. Pages debounce 300 ms and call actions.
   - Pros: single source of truth; scales past loaded sets; matches "empty query → full list" trivially; reuses `getSales` filters (date/branch/payment) untouched.
   - Cons: more server action surface; needs careful Prisma `OR` with `some` relation filters.
   - Effort: Medium.

2. **R1 search — pure client-side filter over already-loaded list**
   Filter in `InventarioList` over fetched products (name/code/description; category when relation present).
   - Pros: zero new DB queries; instant; simplest.
   - Cons: category search requires always loading `getProductsWithBranchStock` (category relation) even when unfiltered; no server pagination; does not scale.
   - Effort: Low.

3. **R2 PDF — follow the `label-print` pattern**
   Server action returns base64 PDF (pdf-lib table: Código | Nombre | Stock | Precio); client converts to Blob + `URL.createObjectURL` and downloads as `inventario-<branchCode>-<YYYYMMDD>.pdf`. Add `Branch.code`. Wizard = 3-step stepper (branch → checkboxes with counter → generate), validations per FASE4.
   - Pros: `pdf-lib` installed; battle-tested pattern + test mocks exist; Blob download UX works; server re-validates branch/product membership.
   - Cons: needs schema change for `code`; wizard is new UI surface; table rendering must handle many products (row overflow/page breaks).
   - Effort: Medium.

4. **R3 role + user provisioning — custom claims + service-role client**
   Add `createServiceClient()` (service role). `createBranchUser` calls `supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'branch_user', branchId } })`; `deleteBranchUser` calls `auth.admin.deleteUser`. Middleware reads `user.app_metadata.role` + `branchId`. `createBranch` compensates on failure (delete Branch row if user creation fails); `deleteBranch` deletes Auth user first, aborts on failure. Return credentials once to admin (SweetAlert2).
   - Pros: no schema/table needed; claims travel in JWT; middleware (Edge) can read them without Prisma; matches Supabase idiom.
   - Cons: claims set only at creation (updates require admin.updateUserById); introduces role infra for the first time (admin routes currently ungated — must add admin check too).
   - Effort: Medium-High (cross-cutting auth change).

5. **R3 alternative — `user_roles`/`UserBranch` Prisma table**
   Store role+branchId in project DB.
   - Pros: relational integrity, easy queries.
   - Cons: middleware cannot use Prisma (Edge runtime) → needs RPC/claims anyway; more moving parts.
   - Effort: High.

## Recommendation

- **R1**: Approach 1 (server-driven) for sales search (requires matching across `SaleItem.product`) and dashboard `getStats`; hybrid client+server for inventory (keep loaded-list client filtering for name/code/description and add category match, or add `search` param to `getProductsWithBranchStock` — decide at propose). Add period select + generic `getStats` on the dashboard.
- **R2**: Approach 3 — reuse `label-print`/pdf-lib conventions; add `Branch.code` via migration + seed; 3-step `ExportWizard` with zod validation and server-side membership re-validation.
- **R3**: Approach 4 — custom claims + service-role client; first-time role infrastructure must also gate admin routes in `src/middleware.ts`. Build the external portal page and `src/middleware/branch.ts` together with it (they share the claim contract).
- Keep all new tests colocated (`*.test.ts`) per repo convention; mock `pdf-lib` and Supabase admin as `label-print` tests do. Align proposals to ACTUAL paths (`src/app/{inventario,ventas,dashboard,sucursales}`, centralized `src/app/actions/*`), not FASE4's `(routes)` group paths.

## Risks

- **No role system exists** — middleware gates nothing beyond login. R1.4 and R3 both require role claims; introducing them changes behavior for ALL admin routes (must not lock out the current admin user). High risk of regression if not sequenced carefully.
- `Branch.code` schema change + first Prisma migration (no `prisma/migrations/` today) — verify migration against the Supabase dev DB; `migrate-prod.sql` shows prod was managed via raw SQL.
- PDF generation in server action: base64 return (label-print precedent) differs from FASE4's "Blob" wording — acceptable, note in design.
- `getSales` currently has no pagination; adding search without pagination may return large sets — add take/skip as part of R1.2.
- `BranchManager` reloads the page on success — must change to surface generated credentials without losing them.
- Mocked "integration"/"e2e" tests (no Playwright, no real DB) cannot satisfy FASE4's integration criteria as written — set expectations with the maintainer (unit + mocked integration is the achievable bar now).

## Ready for Proposal

Yes — gaps are clearly mapped per requirement. The orchestrator should tell the maintainer: (1) the external portal and the role system are greenfield (FASE4 assumes they exist); (2) `Branch.code` is a schema change; (3) admin-route role gating will be introduced for the first time; (4) integration/e2e testing capability is mocked-only today.
