# Tasks: FASE 4 — Mejoras UI, Portal Externo, Export PDF y Usuario de Sucursal

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas | ~900–1200 (add+del) |
| Riesgo presupuesto 400 | High |
| Chained PRs recomendados | Yes |
| Split sugerido | PR 1 fundación → PR 2 roles/portal → PR 3 export → PR 4 R1 |
| Delivery strategy | ask-on-risk (default) |
| Chain strategy | pending (decisión de equipo) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

**Open questions (resolver antes de apply):** (1) ¿se aprueba `Branch.authUserId`?; (2) dominio email (`BRANCH_EMAIL_DOMAIN`); (3) ¿renombrar `middleware.ts`→`proxy.ts`? Tasks siguen el diseño: authUserId aprobado, email derivado, archivo actual.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| 1 | Migración + seed + validaciones + service client + backfill | PR 1 | `npx jest src/lib/validations/branch.test.ts src/lib/validations/export.test.ts` | `npx prisma migrate dev` + `node scripts/backfill-admin-claim.mjs` | revert schema/seed/validations; drop column dev |
| 2 | Rol + middleware branch + provisioning + portal (R3) | PR 2 (base PR 1) | `npx jest src/middleware/branch.test.ts src/app/actions/branch.test.ts src/lib/utils/supabaseAuth.test.ts` | Crear sucursal → Swal credenciales; portal con user branch | revert middleware.ts/branch.ts, supabaseAuth, BranchManager, portal |
| 3 | Export PDF (R2) | PR 3 (base PR 2) | `npx jest src/lib/utils/pdf.test.ts src/app/actions/inventory.test.ts src/app/inventario/components/ExportWizard.test.tsx` | Inventario → Exportar → wizard → descarga PDF | revert pdf.ts/export.ts/ExportWizard/botón |
| 4 | R1: búsquedas + dashboard | PR 4 (base PR 3) | `npx jest src/app/actions/sale.test.ts src/app/actions/dashboard.test.ts` | Escribir "perno" en inventario/ventas; cambiar periodo/sucursal | revert search params, inputs, selects por archivo |

## Phase 1: Fundación

- [x] 1.1 `prisma/schema.prisma`: añadir `Branch.code String @unique` + `Branch.authUserId String? @unique`; migración con backfill id=1→"DEP", resto→`B{id}`; `prisma migrate dev` verde.
- [x] 1.2 `prisma/seed.ts`: Branch "Depósito" con `code: "DEP"` (escenario: default branch code seeded).
- [x] 1.3 `src/lib/validations/branch.ts`: `code` requerido/unique/uppercase en create+update; tests DUPLICATE_CODE.
- [x] 1.4 `src/lib/validations/export.ts` (nuevo): zod `{ branchId int+, selectedProductIds min 1 }` + tests.
- [x] 1.5 `src/lib/supabase/server.ts`: `createServiceClient()` (SUPABASE_SERVICE_ROLE_KEY, sin cookies) + test.
- [x] 1.6 `scripts/backfill-admin-claim.mjs`: claim `admin` al usuario actual con service role (pre-gating).

## Phase 2: R3 — Roles, provisioning y portal

- [x] 2.1 RED: `src/middleware/branch.test.ts` — `decideBranchAccess` 4 casos 403 (branchId≠URL, verbo≠GET, rol≠branch_user, sin claim) + 1 allow.
- [x] 2.2 GREEN: `src/middleware/branch.ts` — función pura `decideBranchAccess` + wiring 403.
- [x] 2.3 `src/lib/utils/supabaseAuth.ts` (nuevo): `generateTemporaryPassword` (≥12 chars, 4 clases, getRandomValues), `generateBranchEmail`, `createBranchUser`, `deleteBranchUser` + tests.
- [x] 2.4 `src/app/actions/branch.ts` createBranch: insert Branch → `createBranchUser`; fallo ⇒ delete compensatorio; retorna `{ branch, credentials }`; tests rollback y no-persistencia.
- [x] 2.5 deleteBranch: `deleteBranchUser` primero ⇒ fallo aborta; HAS_DEPENDENT_DATA; tests.
- [x] 2.6 `src/middleware.ts`: gating admin por claim + delegar `/sucursal/*` (orden: backfill → gating).
- [x] 2.7 `src/components/ui/BranchManager.tsx`: input `code`; credenciales SweetAlert2 sin reload.
- [x] 2.8 Portal `src/app/sucursal/[branchId]/inventory/page.tsx` (nuevo): RSC solo lectura, sin mutación, search client.

## Phase 3: R2 — Export PDF

- [x] 3.1 RED: `src/lib/utils/pdf.test.ts` (mock pdf-lib) — columnas Código|Nombre|Stock|Precio + multipágina.
- [x] 3.2 GREEN: `src/lib/utils/pdf.ts` — tabla pdf-lib multipágina, retorna base64.
- [x] 3.3 RED: `src/app/actions/inventory.test.ts` — `exportBranchProductsPdf` rechaza membresía (sin PDF); success base64 + filename.
- [x] 3.4 GREEN: `src/app/actions/inventory.ts` — `search` param (OR name/code/desc + category.name) + `getBranchProductsForExport` + `exportBranchProductsPdf` (zod + re-validación BranchInventory).
- [x] 3.5 `src/app/inventario/components/ExportWizard.tsx` (nuevo): stepper (paso 1 obligatorio, checkboxes stock>0 + contador, Generar deshabilitado, estado sobrevive errores) + RTL tests.
- [x] 3.6 `src/app/inventario/page.tsx`: botón "Exportar productos" abre ExportWizard.

## Phase 4: R1 — Búsquedas y dashboard

- [x] 4.1 RED: `sale.test.ts` — `getSales(search, take, skip)` → `{ items, total }`; case-insensitive; total 25/take 10.
- [x] 4.2 GREEN: `src/app/actions/sale.ts` — OR `items.some.product.name/code` + paginación (contrato `{ items, total }`).
- [x] 4.3 `src/app/ventas/page.tsx` + `SalesList.tsx`: input search debounce 300 ms + paginación, filtros existentes intactos.
- [x] 4.4 `dashboard.test.ts`: `getStats(type, startDate, endDate, branchId?)` — rango inválido rechazado; global vs branch-scoped.
- [x] 4.5 `src/app/dashboard/page.tsx` + `DashboardCards.tsx`: selects Periodo (7/30/90/Personalizado) y Sucursal; labels "(Sucursal X)"/"(Todas)".
- [x] 4.6 `src/app/inventario/page.tsx` + `InventarioList.tsx`: input unificado debounce 300 ms (quitar search local duplicado); siempre `getProductsWithBranchStock`.

## Phase 5: Verificación y docs

- [x] 5.1 `npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build` verdes (criterio 14).
- [x] 5.2 Docs: README v3 + `docs/` FASE4 (portal, export, provisioning).
- [x] 5.3 Actualizar `.env.example`/AGENTS.md si aplica (`BRANCH_EMAIL_DOMAIN`).
