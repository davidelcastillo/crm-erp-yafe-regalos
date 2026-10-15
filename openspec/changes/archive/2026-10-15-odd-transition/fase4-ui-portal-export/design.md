# Design: FASE 4 — Mejoras UI, Portal Externo, Export PDF y Usuario de Sucursal

## Technical Approach

Tres tracks independientes (R1 UI/portal, R2 export, R3 provisioning) sobre el código real post-Fase 3. Server Actions como única mutación; páginas RSC + Client Components para interacción; validación Zod en server y cliente; PDF con patrón `label-print` (pdf-lib → base64 → Blob en cliente); roles vía custom claims `app_metadata` (el middleware corre en Edge, sin Prisma).

Verificado contra código: `getSales` no tiene paginación (sale.ts:190); `getProductsWithBranchStock` no tiene `search` (inventory.ts:192); `Branch` no tiene `code` (schema.prisma:29); `createServerClient` usa solo anon (server.ts:8); `BranchManager` recarga la página (BranchManager.tsx:90); `getGlobalStats`/`getPerformanceData` sin rango de fechas (dashboard.ts). Portal y sistema de roles son greenfield.

## Architecture Decisions

| # | Decisión | Alternativas | Tradeoff | Elección |
|---|----------|--------------|----------|----------|
| 1 | Búsqueda server-driven | Client-side sobre lista cargada | Escala, "consulta vacía → lista completa" trivial; más superficie de acción | Param `search` en `getProductsWithBranchStock` (OR name/code/description + `category.name` contains, `mode:'insensitive'`) y en `getSales` (OR `items.some.product.name/code`). Inventario siempre usa `getProductsWithBranchStock` (se elimina el fallback `getProducts`). |
| 2 | Roles en claims | Tabla `user_roles` | Claims viajan en JWT y los lee el middleware Edge; set solo en creación | `app_metadata: { role: 'branch_user', branchId }`; backfill `admin` previo al gating estricto. |
| 3 | Un middleware + helpers | Un archivo por ruta | Next.js 16 admite UN solo middleware/proxy (lo modulan imports) | `src/middleware.ts` (entry, gating admin) importa `src/middleware/branch.ts` = módulo plano con función pura `decideBranchAccess({ role, branchId, urlBranchId, method })` testeable sin `NextRequest`. |
| 4 | PDF patrón `label-print` | Blob desde server | Precedente probado con mocks de pdf-lib | `generateProductsPdf` (pdf-lib, tabla multipágina) retorna base64; cliente hace `Blob` + `URL.createObjectURL`. |
| 5 | `Branch.authUserId String? @unique` | Lookup por email (`listUsers`) | `deleteBranch` precisa el userId exacto; lookup = scan O(n) e inestable | Columna opcional en la misma migración que `code`. ⚠️ Excede el schema aprobado → open question. |
| 6 | Compensación no transaccional | Transacción DB única | DB y Auth no comparten transacción | create: insert Branch → `createUser`; si falla, delete Branch (rollback). delete: `deleteUser` primero; si falla, abort. |
| 7 | Email derivado, sin envío | Edge/Resend | FASE4 lo marca opcional | `sucursal-{code}@${BRANCH_EMAIL_DOMAIN ?? 'sucursal.local'}`; credenciales mostradas una vez (SweetAlert2), nunca persistidas. |
| 8 | Estado local + refetch | Librería de estado global | Patrón ya establecido (useState + useCallback) | Wizard con estado interno que sobrevive errores; selects de dashboard re-fetch; sin store nuevo. |

## Data Flow

Export wizard (R2):

    Inventario ──► ExportWizard (client, 3 pasos)
      paso 1: BranchSelector ──► getBranchProductsForExport(branchId) ──► paso 2: checkboxes+contador (stock>0)
      paso 3: exportBranchProductsPdf({branchId, selectedProductIds})
                 │ zod export.ts + re-validación membresía (BranchInventory)
                 ▼
        generateProductsPdf(rows) ──► base64 ──► Blob ──► descarga inventario-<code>-<YYYYMMDD>.pdf

Provisioning (R3):

    BranchManager(create) ──► createBranch
      ├─ prisma: insert Branch (code + authUserId)
      ├─ createBranchUser → auth.admin.createUser(claims) ──► fallo ⇒ delete Branch
      └─ retorna { branch, credentials } ──► SweetAlert2 (sin reload)

    deleteBranch: deleteBranchUser(userId) primero ──► fallo ⇒ abort ──► prisma delete

Routing (R1): `request` → `src/middleware.ts`: públicos (login/static) → `/sucursal/*` → `decideBranchAccess` (403 si rol≠branch_user, branchId≠URL, o verbo≠GET) → admin sin sesión ⇒ redirect /login → sesión sin claim `admin` ⇒ 403 (branch_user ⇒ redirect a su portal).

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/actions/inventory.ts` | Modify | `search` en `getProductsWithBranchStock`; `getBranchProductsForExport`; `exportBranchProductsPdf` |
| `src/lib/utils/pdf.ts` | New | `generateProductsPdf` (pdf-lib, tabla multipágina) |
| `src/lib/validations/export.ts` | New | Zod `{ branchId, selectedProductIds min 1 }` |
| `src/app/inventario/page.tsx` | Modify | Input unificado debounced 300ms + botón "Exportar productos"; siempre `getProductsWithBranchStock` |
| `src/app/inventario/components/InventarioList.tsx` | Modify | Eliminar search local duplicado + `ProductSearch` inline |
| `src/app/inventario/components/ExportWizard.tsx` | New | Stepper 3 pasos |
| `src/app/actions/sale.ts` | Modify | `getSales(search, take=20, skip=0)` → `{ items, total }` |
| `src/app/ventas/page.tsx`, `SalesList.tsx` | Modify | Input búsqueda + paginación |
| `src/app/actions/dashboard.ts` | Modify | `getStats(type, startDate, endDate, branchId?)` + validación rango |
| `src/app/dashboard/page.tsx`, `DashboardCards.tsx` | Modify | Selects Periodo (7/30/90/Personalizado) y Sucursal + label "(Sucursal X)"/"(Todas)" |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | New | Portal RSC solo lectura + search client-side |
| `src/middleware.ts` | Modify | Delegar `/sucursal/*` + gating admin por claim |
| `src/middleware/branch.ts` | New | `decideBranchAccess` puro + wiring 403 |
| `scripts/backfill-admin-claim.mjs` | New | Backfill claim `admin` (service role) ANTES del gating |
| `src/app/actions/branch.ts` | Modify | `createBranch`/`deleteBranch` con Auth + compensación; `code` en validación |
| `src/components/ui/BranchManager.tsx` | Modify | Input `code`; credenciales SweetAlert2; sin reload |
| `src/lib/supabase/server.ts` | Modify | `createServiceClient()` (service role, sin cookies) |
| `src/lib/utils/supabaseAuth.ts` | New | `createBranchUser`, `deleteBranchUser`, `generateTemporaryPassword` (≥12 chars, 4 clases, `crypto.getRandomValues`), `generateBranchEmail` |
| `src/lib/validations/branch.ts` | Modify | `code` unique, uppercase |
| `prisma/schema.prisma` + migración | Modify | `Branch.code @unique` + `authUserId String? @unique`; backfill id=1→"DEP" |
| `prisma/seed.ts` | Modify | Branch "Depósito" con code "DEP" |

## Interfaces / Contracts

```ts
// Claims contract (app_metadata, viajando en el JWT)
type RoleClaim = { role: 'admin' | 'branch_user'; branchId?: number };

// getSales response (nuevo contrato: paginación)
{ success: true; data: { items: Sale[]; total: number } }

// Export
type ExportRow = { code: string; name: string; stock: number; price: number };
{ success: true; data: { pdfBase64: string; fileName: `inventario-${code}-${YYYYMMDD}.pdf` } }

// createBranch
{ success: true; data: { branch: Branch; credentials: { email: string; password: string } } }
```

## Testing Strategy

| Capa | Qué | Cómo |
|------|-----|------|
| Unit | `pdf.ts` (mock pdf-lib), `supabaseAuth.ts` (policy password, email, `createServiceClient`), `validations/export.ts` + `branch.ts` (code) | Colocated `*.test.ts`, patrón `label-print` |
| Unit | `decideBranchAccess` (rol/branchId/verbo: 4 casos 403 + 1 allow) | Función pura, sin NextRequest |
| Integration (mockeada) | `getSales` (search + take/skip + total), `getProductsWithBranchStock` (OR + categoría), `getStats` (rango inválido rechazado), `createBranch` (rollback si createUser falla; credenciales no persistidas), `deleteBranch` (abort si deleteUser falla), `exportBranchProductsPdf` (membresía rechazada, sin PDF) | Mock prisma + mock `supabaseAuth` |
| Component | `ExportWizard` (paso 1 bloqueado, contador, Generar deshabilitado) | RTL |

## Threat Matrix

Cambio con boundary de **routing web** (middleware), no de shell/VCS/PR. Todas las filas `N/A`: no hay paths tipo documentación ejecutable, selección de repo git, estados de commit/push ni comandos de PR. Los casos adversariales de web-routing (branchId≠URL → 403, verbo≠GET → 403, claim ausente → 403) se cubren como RED tests del spec en `decideBranchAccess` y se propagan a `tasks.md`.

## Migration / Rollout

1. `scripts/backfill-admin-claim.mjs` (service role) → claim `admin` al usuario actual, ANTES del gating estricto (mitiga lockout, riesgo #1 del proposal).
2. Migración Prisma: add `code` (backfill id=1→"DEP", otros→`B{id}`), add `authUserId`, NOT NULL + unique.
3. Deploy middleware en orden: login-sólo → gating admin (post-backfill) → rama `/sucursal/*`.
4. Sin feature flags (features siempre activas). Rollback: `git checkout --` + migración drop column (dev) / SQL manual (prod).

## Open Questions

- [ ] ¿Se aprueba `Branch.authUserId` (excede schema aprobado en proposal)? Alternativa: lookup por email derivado.
- [ ] Dominio del email `sucursal-{code}@` (¿`BRANCH_EMAIL_DOMAIN` en `.env`?).
- [ ] ¿Renombrar `middleware.ts` → `proxy.ts` (convención Next 16) en este cambio o dejarlo como alias deprecado?
