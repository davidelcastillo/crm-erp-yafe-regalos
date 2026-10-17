# Proposal: Portal externo público por sucursal — flag `isPublic` (Opción B)

| Campo | Valor |
|---|---|
| **Change** | `portal-externo-publico-isPublic` |
| **Estado** | Propuesta (fase propose) |
| **Fecha** | 2026-08-21 |
| **Modo** | auto \| hybrid (OpenSpec + Engram) |
| **Delivery strategy** | auto-chain |
| **Review budget** | 400 líneas |
| **Predecesora** | `exploration.md` (mismo change) |
| **Rama sugerida** | `feature/portal-externo-publico-ispublic` |

## Intent

Hacer público el catálogo de sucursales (`/sucursal/<id>/inventory`) para que pueda compartirse con clientes sin autenticación, pero de forma controlada: **solo las sucursales marcadas explícitamente como públicas (`Branch.isPublic`) y activas exponen su inventario** (Opción B, elegida por seguridad vs. enumeración total). En paralelo se **elimina el login del portal** (`loginBranch`, `PortalLoginForm`, `/sucursal/<id>/login`, `isPortalLoginPath`, `auth.branch.ts` + tests) y el rol `branch_user` deja de ser parte del modelo de autorización, porque con el portal público el login de sucursal pierde su razón de ser (el problema original de la sucursal 39 "Punto Rosa" con credenciales inválidas queda resuelto de raíz). Además se corrige un bug pre-existente: hoy el catálogo expone sucursales inactivas y productos inactivos.

## Scope

### In Scope
- Schema: `Branch.isPublic Boolean @default(false)` en `prisma/schema.prisma` + migración aplicada a BD dev y prod (proceso memoria #100).
- `getExternalBranchInventory`: checks `isPublic === true && isActive === true` y filtro `Product.active` (fix obligatorio).
- `decideBranchAccess` puro: GET anónimo allow; mantener `method !== GET → deny`; mantener match de URL; eliminar reglas role/claim.
- `proxy.ts`: dejar pasar anónimos a `/sucursal/*`; quitar `isPortalLoginPath` y `getUserBranchId` del flujo.
- Página `inventory`: quitar el guard `getUserBranchId`; corregir el comentario falso (línea 28); `notFound` si la sucursal no es pública/activa.
- Eliminar el login del portal completo: `loginBranch`, `PortalLoginForm`, página `/sucursal/<id>/login`, `isPortalLoginPath`, `src/lib/supabase/branch.ts` + sus tests.
- `BranchManager`: toggle `isPublic` en crear/editar; botón "Portal" → `/sucursal/<id>/inventory` (ya no `/login`).
- Validaciones y actions de branch: persistir `isPublic` en create/update.
- Tests: reescribir `branch.test.ts`; actualizar `proxy.test.ts`; crear `inventory.external.test.ts`; eliminar `auth.branch.test.ts` + `branch.test.ts`.

### Out of Scope
- Login central admin (`/login`, `src/actions/auth.ts`) — el manejo residual de `branch_user` en el redirect del login central se mantiene intacto (deuda, no bloqueante: su destino `/sucursal/<id>/inventory` sigue siendo válido).
- Provisioning de usuarios de sucursal en `createBranch` (`createBranchUser` en `src/lib/utils/supabaseAuth.ts`) — intacto.
- RLS en Supabase (pendiente de seguridad independiente).
- Otras rutas bajo `/sucursal/*` (solo se toca `inventory`).
- Catalog management (CRUD del catálogo) y paginación del catálogo.
- Limpieza de código muerto resultante (`isAuthorizedForBranch`/`getUserBranchId` en `src/lib/supabase/auth.ts`) — opcional, se documenta como deuda.

## Capabilities

### New Capabilities
- `branch-public-flag`: flag de visibilidad pública por sucursal. Contrato: `Branch.isPublic Boolean @default(false)` — **opt-in explícito** (ninguna sucursal queda pública por defecto, las filas existentes reciben `false`); toggle en crear/editar de `BranchManager`; persistencia vía `createBranch`/`updateBranch` (schemas zod con `isPublic`); migración BD dev + prod sin pérdida de datos.

### Modified Capabilities
- `external-branch-catalog` (delta): el catálogo pasa de "autenticado vía branch_user" a **público condicionado**. Contrato: `GET /sucursal/<id>/inventory` visible solo si la sucursal es `isPublic && isActive`; la query filtra `Product.active === true`; expone solo `{ code, name, stock, price }` (sin datos sensibles); sucursal inexistente, no pública o inactiva → mismo resultado (página `notFound`) para no filtrar existencia.
- `app-middleware` (delta): `decideBranchAccess` puro sin role/claim — GET → allow (anónimo incluido), `method !== GET → deny 'method'`, URL sin match `^/sucursal/(\d+)` → deny 'branch'; el middleware puro no toca DB. `proxy.ts` deja pasar anónimos a `/sucursal/*` (sin redirect a `/login`) y elimina `isPortalLoginPath` del flujo; el admin gating de rutas internas se mantiene.
- `branch-management-ui` (delta): `BranchManager` con checkbox "Sucursal pública" (`isPublic`) en crear/editar, badge de estado en el listado, y botón "Portal" apuntando a `/sucursal/<id>/inventory` (ya no al login).

### Removed Capabilities
- `branch-portal-login` (**ELIMINADA**): se remueve `loginBranch`, `PortalLoginForm`, la página `/sucursal/<id>/login`, `isPortalLoginPath` y `src/lib/supabase/branch.ts` (+ tests). El rol `branch_user` deja de existir como modelo de autorización del portal.

## Approach

Seis tracks independientes, secuenciables para auto-chain respetando el budget de 400 líneas.

### Track A — Schema + migración
- `Branch.isPublic Boolean @default(false)` en `prisma/schema.prisma`.
- Migración con `npx prisma migrate dev --name branch_is_public` (genera el SQL y aplica a dev) y aplicación a **prod** siguiendo el proceso de la memoria #100 (`apply_migration` vía MCP por partes; verificar el `project_ref` en `opencode.json`: dev `upytyhardcslniwljvlm` vs prod `zvcgksucblpaqtajdvws`; verificación post-migración: columna presente, `false` en filas existentes, sin pérdida de datos).

### Track B — Middleware/proxy
- `decideBranchAccess`: eliminar reglas `role`/`claim`; mantener `method !== GET → deny` y el match de URL; GET (anónimo o no) → allow. Simplificar `BranchAccessInput` a `{ pathname, method }`.
- `proxy.ts`: quitar import de `isPortalLoginPath` y `getUserBranchId`; en el bloque `!user && !isExcluded`, no redirigir a `/login` cuando `pathname.startsWith('/sucursal/')`; en el bloque con sesión, `/sucursal/*` pasa por `decideBranchAccess({ pathname, method })` (sin role/claim) y `!allowed → /unauthorized`; actualizar comentarios (líneas 32-34, 70-72).

### Track C — Action + página
- `getExternalBranchInventory`: buscar la `Branch` por id; si no existe, `!isPublic` o `!isActive` → retornar `{ success: false }` (la página ya mapea `!success → notFound`); en la query de productos añadir `active: true` y mantener `inventory.some({ branchId })` + `orderBy name asc`.
- Página `inventory`: eliminar `getUserBranchId` y el guard (líneas 3, 24-31); corregir el comentario falso de la línea 28; mantener `notFound()` para NaN y `!success`.

### Track D — Eliminar login del portal
- Borrar: `src/actions/auth.branch.ts`, `src/actions/auth.branch.test.ts`, `src/app/sucursal/[branchId]/login/page.tsx`, `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx`, `src/lib/supabase/branch.ts` (contiene `isPortalLoginPath` + `decideBranchAccess` async muerto + `getBranchIdFromPath` sin uso) y `src/lib/supabase/branch.test.ts`.
- Verificar por grep que no quedan referencias a `loginBranch`/`isPortalLoginPath` (referencias actuales: solo `proxy.ts`, `PortalLoginForm`, tests — todas cubiertas por los tracks B/D/F).

### Track E — UI (BranchManager)
- `src/lib/validations/branch.ts`: `isPublic: z.boolean().default(false)` en `createBranchSchema`; `isPublic: z.boolean().optional()` en `updateBranchSchema`.
- `src/app/actions/branch.ts`: persistir `isPublic` en `createBranch` y `updateBranch`.
- `src/components/ui/BranchManager.tsx`: `isPublic` en `Branch`/`BranchForm`/`EMPTY_FORM`/`openEdit`; checkbox en el form (junto a "Sucursal activa"); badge "Pública" en el listado; botón "Portal" → `/sucursal/${branch.id}/inventory` (y `aria-label` coherente).

### Track F — Tests
- Reescribir `src/middleware/branch.test.ts`: GET anónimo allow; GET allow sin importar role; `POST → deny 'method'`; URL malformada → deny 'branch'; ya no hay casos role/claim.
- Eliminar `src/actions/auth.branch.test.ts` y `src/lib/supabase/branch.test.ts`.
- Crear `src/app/actions/inventory.external.test.ts` (mock de prisma): pública+activa → catálogo; no pública → `success:false`; inactiva → `success:false`; productos inactivos excluidos; branch inexistente → `success:false`.
- Actualizar `src/proxy.test.ts`: quitar el mock de `@/lib/supabase/branch` (usa `requireActual` de `isPortalLoginPath`, se rompería al borrar el módulo) y `getUserBranchId` del mock de `@/lib/supabase/auth`; agregar caso: anónimo en `/sucursal/39/inventory` → sin redirect a `/login`; y POST anónimo a `/sucursal/39/inventory` → sin redirect (405 del framework / deny).
- Extender `src/app/actions/branch.test.ts` con casos de persistencia de `isPublic` (create/update) si el archivo lo permite sin refactor.

## Affected Areas

| Área | Impacto | Descripción |
|---|---|---|
| `prisma/schema.prisma` | Modificado | `Branch.isPublic Boolean @default(false)` |
| BD dev + prod | Migración | Aplicar columna (proceso memoria #100) |
| `src/middleware/branch.ts` | Modificado | `decideBranchAccess` sin role/claim; GET anónimo allow |
| `src/middleware/branch.test.ts` | Reescribir | Nuevos casos (GET/POST/URL) |
| `src/proxy.ts` | Modificado | Anónimos pasan a `/sucursal/*`; sin `isPortalLoginPath`/`getUserBranchId` |
| `src/proxy.test.ts` | Modificado | Mocks actualizados + caso anónimo `/sucursal/*` |
| `src/app/actions/inventory.external.ts` | Modificado | Checks `isPublic`/`isActive` + filtro `Product.active` |
| `src/app/actions/inventory.external.test.ts` | **Nuevo** | Casos de visibilidad |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | Modificado | Sin guard `getUserBranchId`; comentario corregido |
| `src/actions/auth.branch.ts` | **Eliminado** | `loginBranch` |
| `src/actions/auth.branch.test.ts` | **Eliminado** | — |
| `src/app/sucursal/[branchId]/login/page.tsx` | **Eliminado** | Página de login del portal |
| `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx` | **Eliminado** | Form cliente |
| `src/lib/supabase/branch.ts` | **Eliminado** | `isPortalLoginPath` + código muerto |
| `src/lib/supabase/branch.test.ts` | **Eliminado** | — |
| `src/lib/validations/branch.ts` | Modificado | `isPublic` en create/update schemas |
| `src/app/actions/branch.ts` | Modificado | Persistir `isPublic` |
| `src/components/ui/BranchManager.tsx` | Modificado | Toggle `isPublic`; botón Portal → inventory |

## Risks

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Enumeración de IDs de sucursal (probar `isPublic=false`) | Media | Mitigado por diseño: no-pública/inactiva/inexistente devuelven el mismo resultado (`notFound`) → sin leak de existencia ni de datos |
| Exposición de sucursal inactiva y productos inactivos (bug actual) | Alta (hoy ocurre) | Fix obligatorio en Track C: check `isActive` + filtro `Product.active` con test dedicado |
| Rotura de imports al eliminar `auth.branch.ts`/`branch.ts` | Media | Referencias verificadas por grep (solo `proxy.ts`, `PortalLoginForm`, tests); `proxy.test.ts` usa `requireActual` de `isPortalLoginPath` → actualizar mocks en Track F |
| Comportamiento del proxy (redirect-to / anónimos) | Media | Anónimos en `/sucursal/*` ya no setean cookie `redirect-to` ni redirigen a `/login`; caso de test explícito; POST anónimo a páginas responde 405 del framework |
| Admin autenticado en sucursal no pública | Baja | Cambio de comportamiento intencional: el check `isPublic` aplica a todos (la action no distingue roles); documentar en spec |
| Migración a BD prod | Media | Proceso memoria #100 (`apply_migration` por partes, verificación post, switch de `project_ref`); `default(false)` no modifica filas existentes |
| Sin E2E real (sin Playwright configurado) | Alta | Validación manual del flujo público (anónimo → catálogo) en verify + cobertura unitaria de action/middleware/proxy |
| Código muerto residual (`isAuthorizedForBranch`/`getUserBranchId` en `auth.ts`, `branch_user` en login central y provisioning) | Baja | Documentado como deuda fuera de alcance; no bloquea |

## Rollback

- **BD**: revertir la migración con `DROP COLUMN Branch.isPublic` (o el SQL inverso de la migración) en dev y prod; sin pérdida de datos (columna nueva con default).
- **Código**: revertir los commits del change (los archivos eliminados — `auth.branch.ts`, `PortalLoginForm`, página login, `lib/supabase/branch.ts` — se recuperan del historial de git; el cambio es reversible en su totalidad porque es aditivo en schema y sustractivo en flujos de auth).
- **Release**: no publicar en `main` sin receipt de revisión (regla de release del proyecto); si se detecta un problema post-merge, revertir el PR completo antes de liberar.

## Dependencies

- Acceso a BD dev y prod (proceso memoria #100: MCP Supabase con `project_ref` correcto, o `prisma migrate deploy`).
- Prisma CLI para generar la migración.
- Verificación previa por grep de referencias a símbolos eliminados (realizada en exploration: ninguna fuera de los archivos del scope).

## Success Criteria

- [ ] `Branch.isPublic` presente en el schema con `default(false)`; migración aplicada en dev y prod; filas existentes con `isPublic=false`; sin pérdida de datos.
- [ ] Un usuario anónimo (sin sesión) accede a `/sucursal/<id>/inventory` de una sucursal pública y activa → 200 con catálogo (`code, name, stock, price`).
- [ ] Sucursal no pública → `notFound`; sucursal inactiva → `notFound`; sucursal inexistente → `notFound` (mismo resultado en los tres casos).
- [ ] Productos inactivos no aparecen en el catálogo público.
- [ ] `POST` a `/sucursal/*` → deny (`reason: 'method'`); URL malformada (`/sucursal/abc/...`) → deny (`reason: 'branch'`).
- [ ] `/sucursal/<id>/login` devuelve 404; grep sin referencias a `loginBranch`, `isPortalLoginPath`, `PortalLoginForm`.
- [ ] `BranchManager`: toggle `isPublic` funcional en crear y editar y persistido en BD; botón "Portal" → `/sucursal/<id>/inventory`.
- [ ] Tests: `branch.test.ts` reescrito (GET anónimo allow, POST deny, URL deny); `inventory.external.test.ts` creado (casos isPublic/isActive/Product.active); `auth.branch.test.ts` y `branch.test.ts` eliminados; `proxy.test.ts` verde con mocks actualizados y caso anónimo `/sucursal/*`.
- [ ] `npm test` pasa en su totalidad; `tsc` sin errores; lint sin errores nuevos.
- [ ] Sin regresiones en el login central admin (`/login` → `/dashboard`; gating de rutas internas intacto).