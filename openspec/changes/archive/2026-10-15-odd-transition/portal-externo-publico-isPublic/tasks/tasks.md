# Tasks: Portal externo público por sucursal — flag `isPublic` (Opción B)

| Campo | Valor |
|---|---|
| **Change** | `portal-externo-publico-isPublic` |
| **Delivery strategy** | auto-chain |
| **Review budget** | 400 líneas |
| **Chain strategy** | feature-branch-chain |
| **Rama tracker** | `feature/portal-externo-publico-ispublic` |
| **Predecesoras** | `proposal.md`, `design.md`, 5 specs delta + spec obsoleta `branch-portal-login-ui` |

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ≈ 400-500 (schema 1 + migración 10 + middleware 25 + proxy 20 + action 40 + página 10 + BranchManager 50 + validaciones 10 + actions 15 + tests ≈ 200) |
| 400-line budget risk | Alto |
| Chained PRs recommended | Sí |
| Suggested split | PR 1: schema + migración + middleware + proxy → PR 2: action + página + eliminar login → PR 3: UI BranchManager + tests finales |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

> **Nota de carga de revisión (PR 2)**: los borrados de 6 archivos del login suman ≈ 400 líneas de deletions. Se mitiga con commits de trabajo unitario separados dentro del PR 2 y greps de compuerta.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| 1 | Schema `Branch.isPublic` + migración idempotente dev/prod + `decideBranchAccess` GET-only puro + proxy anónimos a `/sucursal/*` | PR 1 | `npx jest src/middleware/branch.test.ts src/proxy.test.ts` | `npx prisma migrate dev --name branch_is_public` en dev + verificación SQL post. Prod: `apply_migration` (memoria #100, prod `zvcgksucblpaqtajdvws`) | Revertir commit PR 1; `DROP COLUMN "Branch"."isPublic"` |
| 2 | `getExternalBranchInventory` checks isPublic/isActive + `Product.active` + página sin guard + eliminar 6 archivos login | PR 2 | `npx jest src/app/actions/inventory.external.test.ts src/proxy.test.ts` + greps 0 | GET anónimo a sucursal pública → 200; no-pública/inactiva/inexistente → 404; `/sucursal/<id>/login` → 404 | Revertir commit PR 2; archivos eliminados se recuperan de git |
| 3 | UI `BranchManager` (checkbox, badge, botón Portal → inventory) + validaciones/actions + tests + suite | PR 3 | `npx jest src/app/actions/branch.test.ts`; cierre: npm test + tsc + lint + build | `npm run dev` flujo admin en `/sucursales` | Revertir commit PR 3 |

## Fase 1: Schema + Middleware/Proxy (PR 1)

**1.1 Schema `isPublic` + migración idempotente dev/prod**
Desc: `Branch.isPublic Boolean @default(false)` en prisma/schema.prisma; migración dev (`prisma migrate dev --name branch_is_public`) y prod (memoria #100, SQL `DO $$ IF NOT EXISTS ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false`); verificar post: columna, `false` en filas existentes, conteos intactos.
AC: columna con default false; filas existentes false; sin pérdida; rollback `DROP COLUMN`.
Riesgos: apuntar a BD equivocada (verificar project_ref); SQL no idempotente.
Deps: acceso MCP ambos proyectos; Prisma CLI.

**1.2 `decideBranchAccess` simplificado + `branch.test.ts` reescrito (RED→GREEN)**
Desc: reescribir test (4 casos: GET anónimo allow, GET admin allow, POST deny 'method', URL malformada deny 'branch'); simplificar BranchAccessInput a { pathname, method }; eliminar reglas role/claim; mantener method!==GET → deny → regex ^/sucursal/(\d+) → deny → allow; JSDoc actualizado.
AC: 4 casos pasan; sin role/claim; test sin casos viejos.
Riesgos: dejar casos viejos (reescribir completo); romper tipo reason.
Deps: 1.3 depende de la nueva firma.

**1.3 `proxy.ts` anónimos en `/sucursal/*` + `proxy.test.ts` actualizado (RED→GREEN)**
Desc: quitar import @/lib/supabase/branch (línea 7) y getUserBranchId (línea 6); eliminar isPortalLoginPath de isExcluded (línea 45); en `!user && !isExcluded` anteponer `if (pathname.startsWith('/sucursal/')) return response;`; bloque con sesión /sucursal/* → decideBranchAccess({pathname, method}) sin role/claim ni isPortalLoginPath; corregir comentarios 32-34 y 70-72; matcher intacto. Tests: quitar mock requireActual y getUserBranchId; +4 casos (anónimo GET sin redirect, anónimo POST sin redirect, autenticado GET allow, malformado → /unauthorized); mantener regresión.
AC: 4 casos nuevos + regresión verdes; sin getUserBranchId en proxy; sin requireActual.
Riesgos: requireActual se rompe al borrar módulo (quitar en este PR); romper gating interno.
Deps: 1.2.

## Fase 2: Catálogo público + eliminación login (PR 2)

**2.1 `getExternalBranchInventory` checks + filtro + test nuevo (RED→GREEN)**
Desc: crear inventory.external.test.ts (7 casos: pública+activa→catálogo sin id; no pública→success:false; inactiva→success:false; inexistente→success:false; producto inactivo excluido; pública sin inventario→data:[]; zod branchId inválido→success:false). Implementar: findUnique Branch (isPublic/isActive) → !branch||!isPublic||!isActive → { success: false }; product.findMany con active:true + inventory.some + orderBy name; select { code, name, price, inventory } sin id.
AC: 7 casos pasan; success:false idéntico sin leak; contrato sin id/authUserId/email; sin inventario → data:[].
Riesgos: filtrar motivo en error; el check aplica a admins (intencional).
Deps: 1.1.

**2.2 Página `inventory` sin guard + comentario corregido**
Desc: eliminar import + guard getUserBranchId (líneas 3, 24-31); corregir comentario falso línea 28; mantener NaN→notFound, !success→notFound, force-dynamic.
AC: sin getUserBranchId en página; comentario corregido; NaN→notFound; !success→notFound.
Riesgos: import sin uso (tsc); romper flujo admin (intencional).
Deps: 2.1.

**2.3 Eliminar login del portal (6 archivos) + greps 0 + proxy.test.ts sin requireActual**
Desc: borrar auth.branch.ts, auth.branch.test.ts, sucursal/[branchId]/login/page.tsx, PortalLoginForm.tsx, lib/supabase/branch.ts, lib/supabase/branch.test.ts. Greps loginBranch/isPortalLoginPath/PortalLoginForm = 0. Anotar archive: branch-portal-login-ui obsoleta.
AC: 6 archivos no existen; greps 0; /sucursal/<id>/login → 404; tsc compila.
Riesgos: import residual; borrar archivo usado por otro flujo (grep verificado).
Deps: 1.3, 2.2.

## Fase 3: UI BranchManager (PR 3)

**3.1 Validaciones `isPublic` + persistencia + tests (RED→GREEN)**
Desc: extender branch.test.ts (5 casos: createSchema default false; updateSchema optional; createBranch persiste isPublic:true objectContaining; updateBranch persiste isPublic:false; updateBranch sin isPublic no lo incluye). Implementar: validations createBranchSchema isPublic default false + updateBranchSchema optional; actions createBranch `isPublic: validatedData.isPublic` en tx.branch.create; updateBranch `...(isPublic !== undefined && { isPublic })`.
AC: 5 casos pasan; default false; optional update; authUserId intacto.
Riesgos: romper payload createBranch (default garantiza valor); tocar authUserId.
Deps: 1.1.

**3.2 `BranchManager.tsx`: checkbox, badge, botón Portal → inventory**
Desc: Branch/BranchForm con isPublic; EMPTY_FORM isPublic:false; openEdit precarga; handleSubmit payload isPublic; checkbox "Sucursal pública" junto a "Sucursal activa" (w-5 h-5 rounded, label text-sm text-[#222222]); badge "Pública" (px-2 py-0.5 bg-[#ff385c]/10 text-[#ff385c] rounded-full text-[11px] font-semibold); botón Portal href → /sucursal/${branch.id}/inventory (conservar aria-label, min-h-[44px], touch-manipulation).
AC: checkbox create/edit; EMPTY_FORM desmarcado; openEdit precarga; payload; badge; botón → inventory.
Riesgos: romper modal credenciales (isPublic sin tocar credentials); olvidar atributos táctiles.
Deps: 3.1.

## Fase 4: Cierre (PR 3)

**4.1 Suite completa como compuerta**
Desc: npm test (suite completa), npx tsc --noEmit, npm run lint, npm run build; greps 0.
AC: suite verde; tsc sin errores; lint sin nuevos; build OK; greps 0.
Riesgos: tests de otro módulo dependientes de isPortalLoginPath (npm test + tsc).
Deps: Fases 1-3.

**4.2 Checklist migración prod + verificación manual**
Desc: aplicar migración prod (memoria #100, si no en 1.1); verificar manual: anónimo GET pública → 200; no-pública/inactiva/inexistente → 404; /sucursal/<id>/login → 404; login central admin intacto; BranchManager toggle/badge/botón. Anotar deuda isAuthorizedForBranch/getUserBranchId y spec obsoleta.
AC: checklist completo documentado.
Riesgos: sin E2E real (validación manual); apply_migration a BD equivocada.
Deps: 4.1 verde.

## Delivery Plan (auto-chain + feature-branch-chain)

Tracker `feature/portal-externo-publico-ispublic` (draft, no-merge; solo el tracker mergea a main con receipt).
- PR 1 (base tracker): commits — `feat(schema): agregar Branch.isPublic...`, `test(middleware): reescribir branch.test.ts...`, `refactor(middleware): simplificar decideBranchAccess...`, `refactor(proxy): dejar pasar anonimos...`, `test(proxy): actualizar mocks...`
- PR 2 (base PR1): `test(catalog): crear inventory.external.test.ts...`, `fix(catalog): enforce isPublic/isActive...`, `fix(portal): quitar guard getUserBranchId...`, `feat(portal): eliminar login del portal...`
- PR 3 (base PR2): `feat(branches): persistir isPublic...`, `feat(branches): toggle isPublic, badge Publica...`, `test(branches): casos de persistencia...`, `chore: suite completa...`

Regla de cadena: si un PR hijo muestra diff del padre → retarget/rebase. No mezclar estrategias.

## Key Learnings

1. El borrado de 6 archivos del login suma ~400 líneas de deletions (pesan tanto como adiciones en el forecast).
2. proxy.test.ts usa jest.requireActual de isPortalLoginPath → quitar el mock antes o en el mismo PR del borrado.
3. El check de visibilidad vive en la action (no middleware) para mantener la función pura sin DB.
4. branch-portal-login-ui queda obsoleta (archivos objetivo eliminados).
5. Migración prod exige verificar project_ref (dev upytyhardcslniwljvlm vs prod zvcgksucblpaqtajdvws) antes de cada apply_migration.